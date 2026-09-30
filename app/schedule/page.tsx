"use client";

import "./schedule.css";

import { useEffect, useState } from "react";


const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type NextSession = {
  meetingKey: number;
  name: string;
  type: string;
  meetingName: string;
  location: string;
  country: string;
  circuit: string;
  startDate: string;
  endDate: string;
};

type SessionPreview = {
  meetingKey: number;
  session: string;
  type: string;
  meetingName: string;
  location: string;
  circuit: string;
  startDate: string;
  endDate: string;
  status: string;
  message: string;
};

type ScheduleSession = {
  sessionKey: number;
  name: string;
  type: string;
  startDate: string;
  endDate: string;
};

type RaceWinner = {
  status: string;
  position: number;
  driverNumber: number;
  driverName: string;
  teamName: string | null;
  headshotUrl: string | null;
};

type ScheduleMeeting = {
  meetingKey: number;
  name: string;
  officialName: string;
  location: string;
  country: string;
  countryCode: string;
  round: number | null;
  gmtOffset: string;
  circuit: string;
  sessions: ScheduleSession[];
};

type SelectedSession = {
  meeting: ScheduleMeeting;
  session: ScheduleSession;
};

type SessionState = "upcoming" | "live" | "finished";

function formatCountdown(milliseconds: number) {
  if (milliseconds <= 0) {
    return "00:00:00";
  }

  const totalSeconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}D ${String(hours).padStart(2, "0")}:${String(
      minutes
    ).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(hours).padStart(2, "0")}:${String(
    minutes
  ).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatSessionDate(dateString: string) {
  return new Date(dateString).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRaceDates(meeting: ScheduleMeeting) {
  if (!meeting.sessions.length) {
    return "";
  }

  const dates = meeting.sessions.flatMap((session) => [
    new Date(session.startDate),
    new Date(session.endDate),
  ]);

  const start = dates.reduce((earliest, date) =>
    date < earliest ? date : earliest
  );

  const end = dates.reduce((latest, date) =>
    date > latest ? date : latest
  );

  const startMonth = start.toLocaleString([], {
    month: "short",
  });

  const endMonth = end.toLocaleString([], {
    month: "short",
  });

  if (
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear()
  ) {
    return `${startMonth} ${start.getDate()}–${end.getDate()}`;
  }

  return `${startMonth} ${start.getDate()}–${endMonth} ${end.getDate()}`;
}

function getSessionState(
  session: ScheduleSession,
  currentTime: number
): SessionState {
  const start = new Date(session.startDate).getTime();
  const end = new Date(session.endDate).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return "upcoming";
  }

  if (currentTime < start) {
    return "upcoming";
  }

  if (currentTime <= end) {
    return "live";
  }

  return "finished";
}

function getMeetingProgressState(
  meeting: ScheduleMeeting,
  currentTime: number
): "completed" | "current" | "upcoming" {
  const raceSession = meeting.sessions.find(
    (session) => session.type === "Race"
  );

  if (!raceSession) {
    return "upcoming";
  }

  const raceStart = new Date(raceSession.startDate).getTime();
  const raceEnd = new Date(raceSession.endDate).getTime();

  if (Number.isNaN(raceStart) || Number.isNaN(raceEnd)) {
    return "upcoming";
  }

  if (raceEnd < currentTime) {
    return "completed";
  }

  if (raceStart <= currentTime && currentTime <= raceEnd) {
    return "current";
  }

  return "upcoming";
}

export default function SchedulePage() {
  const [nextSession, setNextSession] =
    useState<NextSession | null>(null);

  const [schedule, setSchedule] =
    useState<ScheduleMeeting[]>([]);

  const [selectedSession, setSelectedSession] =
    useState<SelectedSession | null>(null);

  const [sessionPreview, setSessionPreview] =
    useState<SessionPreview | null>(null);

  const [openMeetingKey, setOpenMeetingKey] =
    useState<number | null>(null);

  const [scheduleFilter, setScheduleFilter] = useState<
    "upcoming" | "completed" | "sprints" | "all"
  >("upcoming");

  const [countdown, setCountdown] =
    useState("00:00:00");

  const [currentTime, setCurrentTime] =
    useState(0);

  const [raceWinners, setRaceWinners] =
    useState<Record<number, RaceWinner>>({});

  const [raceWinnersLoading, setRaceWinnersLoading] =
    useState(true);

  /*
   * Determine the currently active meeting.
   *
   * If a session is live, that meeting is current.
   * Otherwise use the manually opened meeting.
   */
  const currentMeeting =
    schedule.find((meeting) =>
      meeting.sessions.some((session) => {
        const state = getSessionState(
          session,
          currentTime
        );

        return state === "live";
      })
    ) ??
    schedule.find(
      (meeting) =>
        meeting.meetingKey === openMeetingKey
    );

  /*
   * Load schedule
   */
  useEffect(() => {
    const loadSchedule = async () => {
      try {
        const response = await fetch(
          `${API_URL}/schedule`
        );

        if (!response.ok) {
          throw new Error("Failed to load schedule");
        }

        const data = await response.json();

        const meetings: ScheduleMeeting[] =
          (data.meetings ?? []).filter(
            (meeting: ScheduleMeeting) =>
              !meeting.name
                .toLowerCase()
                .includes("pre-season testing")
          );

        const now = Date.now();

        /*
         * Automatically open the current race weekend.
         * If no race weekend is currently active,
         * open the next upcoming race weekend.
         */
        const activeMeeting =
          meetings.find((meeting) =>
            meeting.sessions.some((session) => {
              const start = new Date(
                session.startDate
              ).getTime();

              const end = new Date(
                session.endDate
              ).getTime();

              return start <= now && now <= end;
            })
          ) ??
          meetings.find((meeting) => {
            const raceSession =
              meeting.sessions.find(
                (session) =>
                  session.type === "Race"
              );

            if (!raceSession) {
              return false;
            }

            return (
              new Date(
                raceSession.startDate
              ).getTime() > now
            );
          });

        if (activeMeeting) {
          setOpenMeetingKey(
            activeMeeting.meetingKey
          );
        }

        setSchedule(meetings);
      } catch (error) {
        console.warn(
          "Schedule refresh failed:",
          error
        );
      }
    };

    const loadNextSession = async () => {
      try {
        const response = await fetch(
          `${API_URL}/schedule/next`
        );

        if (!response.ok) {
          throw new Error(
            "Failed to load next session"
          );
        }

        const data: NextSession | null =
          await response.json();

        setNextSession(data);
      } catch (error) {
        console.warn(
          "Next session refresh failed:",
          error
        );
      }
    };

    loadSchedule();
    loadNextSession();

    const interval = setInterval(() => {
      loadSchedule();
      loadNextSession();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  /*
   * Load race winners for completed races.
   */
  useEffect(() => {
    if (schedule.length === 0) {
      return;
    }

    const fetchRaceWinners = async () => {
      const completedRaces = schedule
        .map((meeting) => {
          const raceSession =
            meeting.sessions.find(
              (session) =>
                session.type === "Race"
            );

          if (!raceSession) {
            return null;
          }

          const raceEnd = new Date(
            raceSession.endDate
          ).getTime();

          if (
            Number.isNaN(raceEnd) ||
            raceEnd >= Date.now()
          ) {
            return null;
          }

          return raceSession;
        })
        .filter(
          (
            session
          ): session is ScheduleSession =>
            session !== null
        );

      const winners: Record<
        number,
        RaceWinner
      > = {};

      for (const race of completedRaces) {
        try {
          const response = await fetch(
            `${API_URL}/race-winner/${race.sessionKey}`
          );

          if (!response.ok) {
            continue;
          }

          const winner: RaceWinner =
            await response.json();

          if (winner.status === "finished") {
            winners[race.sessionKey] = winner;
          }
        } catch (error) {
          console.error(
            `Failed to load winner for session ${race.sessionKey}`,
            error
          );
        }

        await new Promise((resolve) =>
          setTimeout(resolve, 1000)
        );
      }

      setRaceWinners(winners);
      setRaceWinnersLoading(false);
    };

    fetchRaceWinners();
  }, [schedule]);

  /*
   * Keep the current/active race visible in the
   * internal calendar scroll area.
   */
  useEffect(() => {
    if (
      !currentMeeting ||
      schedule.length === 0
    ) {
      return;
    }

    const timer = setTimeout(() => {
      const activeRace = document.getElementById(
        `schedule-meeting-${currentMeeting.meetingKey}`
      );

      if (activeRace instanceof HTMLElement) {
        const list = document.querySelector(
          ".schedule-calendar-list"
        );

        if (list instanceof HTMLElement) {
          list.scrollTo({
            top:
              activeRace.offsetTop -
              list.offsetTop,
            behavior: "smooth",
          });
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [
    currentMeeting?.meetingKey,
    schedule.length,
  ]);

  /*
   * Countdown
   */
  useEffect(() => {
    if (!nextSession) {
      return;
    }

    const updateCountdown = () => {
      const target = new Date(
        nextSession.startDate
      ).getTime();

      const remaining =
        target - Date.now();

      setCountdown(
        formatCountdown(remaining)
      );
    };

    updateCountdown();

    const interval = setInterval(
      updateCountdown,
      1000
    );

    return () => clearInterval(interval);
  }, [nextSession]);

  /*
   * Current time
   */
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(Date.now());
    };

    updateTime();

    const interval = setInterval(
      updateTime,
      1000
    );

    return () => clearInterval(interval);
  }, []);

  const loadSessionPreview = async (
    meetingKey: number,
    sessionName: string
  ) => {
    try {
      const response = await fetch(
        `${API_URL}/session/${meetingKey}/${encodeURIComponent(sessionName)}`
      );

      if (!response.ok) {
        throw new Error(
          "Failed to load session preview"
        );
      }

      const data: SessionPreview =
        await response.json();

      setSessionPreview(data);
    } catch (error) {
      console.error(
        "Could not load session preview:",
        error
      );
    }
  };

  const handleMeetingClick = (
    meeting: ScheduleMeeting
  ) => {
    setOpenMeetingKey((current) =>
      current === meeting.meetingKey
        ? null
        : meeting.meetingKey
    );
  };

  const handleSessionClick = (
    meeting: ScheduleMeeting,
    session: ScheduleSession
  ) => {
    setSelectedSession({
      meeting,
      session,
    });

    setSessionPreview(null);

    loadSessionPreview(
      meeting.meetingKey,
      session.name
    );
  };

  /*
   * Completed rounds
   */
  const completedRounds = schedule.filter(
    (meeting) =>
      meeting.sessions.length > 0 &&
      meeting.sessions.every(
        (session) =>
          new Date(
            session.endDate
          ).getTime() < currentTime
      )
  ).length;

  /*
   * Filters
   */
  const filteredSchedule =
    schedule.filter((meeting) => {
      const raceSession =
        meeting.sessions.find(
          (session) =>
            session.type === "Race"
        );

      if (!raceSession) {
        return false;
      }

      const raceEnd = new Date(
        raceSession.endDate
      ).getTime();

      const isCompleted =
        raceEnd < currentTime;

      const isSprintWeekend =
        meeting.sessions.some((session) => {
          const sessionType =
            session.type.toLowerCase();

          const sessionName =
            session.name.toLowerCase();

          return (
            sessionType.includes("sprint") ||
            sessionName.includes("sprint")
          );
        });

      switch (scheduleFilter) {
        case "completed":
          return isCompleted;

        case "upcoming":
          return !isCompleted;

        case "sprints":
          return isSprintWeekend;

        case "all":
        default:
          return true;
      }
    });

  /*
   * Scroll to a race from the progress timeline.
   */
  const handleProgressClick = (
    meeting: ScheduleMeeting
  ) => {
    setOpenMeetingKey(meeting.meetingKey);

    setTimeout(() => {
      const element = document.getElementById(
        `schedule-meeting-${meeting.meetingKey}`
      );

      const list = document.querySelector(
        ".schedule-calendar-list"
      );

      if (
        element instanceof HTMLElement &&
        list instanceof HTMLElement
      ) {
        list.scrollTo({
          top:
            element.offsetTop -
            list.offsetTop,
          behavior: "smooth",
        });
      }
    }, 50);
  };

  const getNextUpcomingMeeting = () => {
  return schedule
    .filter((meeting) => {
      const raceSession = meeting.sessions.find(
        (session) => session.type === "Race"
      );

      if (!raceSession) {
        return false;
      }

      return (
        new Date(raceSession.startDate).getTime() >
        currentTime
      );
    })
    .sort((a, b) => {
      const aRace = a.sessions.find(
        (session) => session.type === "Race"
      );

      const bRace = b.sessions.find(
        (session) => session.type === "Race"
      );

      if (!aRace || !bRace) {
        return 0;
      }

      return (
        new Date(aRace.startDate).getTime() -
        new Date(bRace.startDate).getTime()
      );
    })[0];
};

  return (
    <main className="page schedule-page">
      <div className="container">
        <header className="header schedule-page-header">
          <div>
            <div className="logo">
              F1 LIVE
            </div>

            <div className="schedule-page-subtitle">
              2026 Formula 1 Schedule
            </div>
          </div>

          <div className="live-indicator">
            <span className="live-dot next" />
            Schedule
          </div>
        </header>

        <section
          id="schedule-calendar"
          className="schedule-calendar-panel panel"
        >
          {/* =====================================
              TOP BANNER
              ===================================== */}

          <div className="schedule-calendar-banner">
            <div className="schedule-calendar-banner-left">
              <div className="schedule-section-eyebrow">
                2026 SEASON
              </div>

              <div className="panel-title">
                Race Calendar
              </div>

              <div className="schedule-calendar-completed">
                <strong>
                  {completedRounds} of{" "}
                  {schedule.length || 23}
                </strong>

                <span>completed</span>
              </div>

              <p className="schedule-calendar-description">
                All 23 rounds of the 2026 Formula 1
                season.
              </p>
            </div>

            <div className="schedule-calendar-banner-right">
              <div className="schedule-calendar-next-label">
                NEXT SESSION
              </div>

              <div className="schedule-calendar-next-type">
                {nextSession?.name || "Loading..."}
              </div>

              <div className="schedule-calendar-next-name">
                {nextSession?.meetingName ||
                  "Loading..."}
              </div>

              {nextSession && (
                <div className="schedule-calendar-next-location">
                  {nextSession.location},{" "}
                  {nextSession.country}
                </div>
              )}

              <div className="schedule-calendar-next-countdown-label">
                STARTS IN
              </div>

              <div className="schedule-calendar-next-countdown">
                {countdown}
              </div>
            </div>
          </div>

          {/* =====================================
              SEASON PROGRESS
              ===================================== */}

          <div className="schedule-progress">
            <div className="schedule-progress-header">
              <div>
                <div className="schedule-progress-label">
                  SEASON PROGRESS
                </div>

                <div className="schedule-progress-title">
                  {completedRounds} of{" "}
                  {schedule.length || 23} complete
                </div>
              </div>

              <div className="schedule-progress-legend">
                <span>
                  <span className="schedule-progress-legend-dot completed" />
                  Completed
                </span>

                <span>
                  <span className="schedule-progress-legend-dot current" />
                  Current
                </span>

                <span>
                  <span className="schedule-progress-legend-dot upcoming" />
                  Upcoming
                </span>
              </div>
            </div>

            <div className="schedule-progress-track">
              {schedule.map((meeting, index) => {
                const state =
                  getMeetingProgressState(
                    meeting,
                    currentTime
                  );

                const isCurrent =
                  currentMeeting?.meetingKey ===
                  meeting.meetingKey;

                const isSprintWeekend =
                  meeting.sessions.some((session) => {
                    const sessionType =
                      session.type.toLowerCase();

                    const sessionName =
                      session.name.toLowerCase();

                    return (
                      sessionType.includes("sprint") ||
                      sessionName.includes("sprint")
                    );
                  });

                return (
                  <button
                    key={meeting.meetingKey}
                    type="button"
                    className={`schedule-progress-round ${state} ${
                      isCurrent ? "selected" : ""
                    } ${isSprintWeekend ? "sprint" : ""}`}
                    onClick={() =>
                      handleProgressClick(
                        meeting
                      )
                    }
                    title={`${meeting.name} — R${
                      meeting.round ??
                      index + 1
                    }${isSprintWeekend ? " — Sprint Weekend" : ""}`}
                    aria-label={`Round ${
                      meeting.round ??
                      index + 1
                    }: ${meeting.name}${
                      isSprintWeekend
                        ? ", Sprint weekend"
                        : ""
                    }`}
                  >
                    <span className="schedule-progress-node">
                      {state === "completed"
                        ? "✓"
                        : meeting.round ??
                          index + 1}
                    </span>

                    <span className="schedule-progress-round-label">
                      R
                      {meeting.round ??
                        index + 1}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="schedule-progress-phases">
              <span className="completed">
                COMPLETED
              </span>

              <span className="current">
                CURRENT
              </span>

              <span className="upcoming">
                UPCOMING
              </span>
            </div>
          </div>

          {/* =====================================
              FILTERS
              ===================================== */}

          <div className="schedule-filters">
            {[
            {
              key: "upcoming",
              label: "Upcoming",
            },
            {
              key: "completed",
              label: "Completed",
            },
            {
              key: "sprints",
              label: "Sprints",
            },
            { key: "all", label: "All" },
            ].map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`schedule-filter ${
                  scheduleFilter ===
                  filter.key
                    ? "active"
                    : ""
                }`}
                onClick={() => {
                  const nextFilter =
                    filter.key as
                      | "all"
                      | "completed"
                      | "upcoming"
                      | "sprints";

                  setScheduleFilter(nextFilter);

                  if (nextFilter === "upcoming") {
                    const nextMeeting =
                      getNextUpcomingMeeting();

                    if (nextMeeting) {
                      setOpenMeetingKey(
                        nextMeeting.meetingKey
                      );

                      setTimeout(() => {
                        const element =
                          document.getElementById(
                            `schedule-meeting-${nextMeeting.meetingKey}`
                          );

                        const list =
                          document.querySelector(
                            ".schedule-calendar-list"
                          );

                        if (
                          element instanceof HTMLElement &&
                          list instanceof HTMLElement
                        ) {
                          list.scrollTo({
                            top:
                              element.offsetTop -
                              list.offsetTop,
                            behavior: "smooth",
                          });
                        }
                      }, 50);
                    }
                  }
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* =====================================
              BREADCRUMBS
              ===================================== */}

          <div className="schedule-calendar-breadcrumbs">
            <span>
              2026 SEASON
            </span>

            <span className="schedule-breadcrumb-separator">
              /
            </span>

            <strong>
              RACE CALENDAR
            </strong>
          </div>

          {/* =====================================
              SCHEDULE COUNT
              ===================================== */}

          <div className="panel-header schedule-calendar-list-header">
            <div>
              <div className="schedule-calendar-count">
                {filteredSchedule.length}{" "}
                {filteredSchedule.length === 1
                  ? "Round"
                  : "Rounds"}
              </div>
            </div>
          </div>

          {/* =====================================
              CALENDAR
              ===================================== */}

          <div className="schedule-calendar-list">
            {schedule.length === 0 ? (
              <div className="schedule-empty">
                Loading schedule...
              </div>
            ) : filteredSchedule.length === 0 ? (
              <div className="schedule-empty">
                No races match this filter.
              </div>
            ) : (
              filteredSchedule.map((meeting) => {
                const isOpen =
                  openMeetingKey ===
                  meeting.meetingKey;

                const isCompleted =
                  meeting.sessions.length > 0 &&
                  meeting.sessions.every(
                    (session) =>
                      new Date(
                        session.endDate
                      ).getTime() <
                      currentTime
                  );

                const isCurrent =
                  currentMeeting?.meetingKey ===
                  meeting.meetingKey;

                const raceSession =
                  meeting.sessions.find(
                    (session) =>
                      session.type === "Race"
                  );

                const winner =
                  raceSession
                    ? raceWinners[
                        raceSession
                          .sessionKey
                      ]
                    : undefined;

                return (
                  <article
                    key={meeting.meetingKey}
                    id={`schedule-meeting-${meeting.meetingKey}`}
                    className={`schedule-race ${
                      isCompleted
                        ? "completed"
                        : ""
                    } ${
                      isCurrent
                        ? "current"
                        : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="schedule-race-header"
                      onClick={() =>
                        handleMeetingClick(
                          meeting
                        )
                      }
                      aria-expanded={isOpen}
                    >
                      <div className="schedule-race-round">
                        R
                        {meeting.round ??
                          ""}
                      </div>

                      <div className="schedule-race-main">
                        <div className="schedule-race-name">
                          {meeting.name}
                        </div>

                        <div className="schedule-race-circuit">
                          {meeting.circuit}
                        </div>
                      </div>

                      <div className="schedule-race-meta">
                        <div className="schedule-race-dates">
                          {formatRaceDates(
                            meeting
                          )}
                        </div>

                        <div
                          className={`schedule-race-status ${
                            isCompleted
                              ? "finished"
                              : isCurrent
                              ? "current"
                              : "upcoming"
                          }`}
                        >
                          {isCompleted
                            ? "FINISHED"
                            : isCurrent
                            ? "CURRENT"
                            : "UPCOMING"}
                        </div>
                      </div>

                      <div className="schedule-race-chevron">
                        {isOpen
                          ? "▼"
                          : "▶"}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="schedule-race-sessions">
                        {isCompleted &&
                        winner ? (
                          <div className="schedule-race-winner">
                            <div className="schedule-race-winner-label">
                              🏆 WINNER
                            </div>

                            <div className="schedule-race-winner-content">
                              <div className="schedule-race-winner-info">
                                <div className="schedule-race-winner-name">
                                  {
                                    winner.driverName
                                  }
                                </div>

                                <div className="schedule-race-winner-number">
                                  #
                                  {
                                    winner.driverNumber
                                  }
                                </div>

                                <div className="schedule-race-winner-team">
                                  {
                                    winner.teamName
                                  }
                                </div>
                              </div>
                            </div>

                            <div className="schedule-race-winner-details">
                              <div>
                                <span>
                                  GRAND PRIX
                                </span>

                                <strong>
                                  {
                                    meeting.name
                                  }
                                </strong>
                              </div>

                              <div>
                                <span>
                                  CIRCUIT
                                </span>

                                <strong>
                                  {
                                    meeting.circuit
                                  }
                                </strong>
                              </div>

                              <div>
                                <span>
                                  DATE
                                </span>

                                <strong>
                                  {formatRaceDates(
                                    meeting
                                  )}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  STATUS
                                </span>

                                <strong>
                                  FINISHED
                                </strong>
                              </div>
                            </div>
                          </div>
                        ) : isCompleted ? (
                          <div className="schedule-race-winner">
                            <div className="schedule-race-winner-label">
                              RACE WINNER
                            </div>

                            <div className="schedule-race-winner-loading">
                              {raceWinnersLoading
                                ? "Loading winner..."
                                : "Winner unavailable"}
                            </div>
                          </div>
                        ) : (
                          meeting.sessions.map(
                            (session) => {
                              const state =
                                getSessionState(
                                  session,
                                  currentTime
                                );

                              return (
                                <button
                                  key={`${meeting.meetingKey}-${session.sessionKey}`}
                                  type="button"
                                  className={`schedule-race-session ${state}`}
                                  onClick={() =>
                                    handleSessionClick(
                                      meeting,
                                      session
                                    )
                                  }
                                >
                                  <div className="schedule-race-session-info">
                                    <div className="schedule-race-session-name">
                                      {
                                        session.name
                                      }
                                    </div>

                                    <div className="schedule-race-session-date">
                                      {formatSessionDate(
                                        session.startDate
                                      )}
                                    </div>
                                  </div>

                                  <div className="schedule-race-session-status">
                                    <span
                                      className={`schedule-status-dot ${state}`}
                                    />

                                    {state ===
                                    "finished"
                                      ? "FINISHED"
                                      : state ===
                                        "live"
                                      ? "LIVE"
                                      : "UPCOMING"}
                                  </div>
                                </button>
                              );
                            }
                          )
                        )}
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>

        {/* =====================================
            SESSION DETAILS
            ===================================== */}

        {selectedSession && (
          <section className="panel schedule-session-details">
            <div className="panel-header">
              <div className="panel-title">
                Session Details
              </div>

              <button
                type="button"
                className="session-detail-close"
                onClick={() => {
                  setSelectedSession(null);
                  setSessionPreview(null);
                }}
                aria-label="Close session details"
              >
                ×
              </button>
            </div>

            <div className="session-detail">
              {sessionPreview && (
                <div className="session-preview-status">
                  {sessionPreview.status ===
                  "preview"
                    ? "Historical session preview"
                    : sessionPreview.status}
                </div>
              )}

              <div className="session-detail-name">
                {
                  selectedSession
                    .session.name
                }
              </div>

              <div className="session-detail-meeting">
                {
                  selectedSession
                    .meeting.name
                }
              </div>

              <div className="session-detail-location">
                {
                  selectedSession
                    .meeting.location
                }
                ,{" "}
                {
                  selectedSession
                    .meeting.country
                }
              </div>

              <div className="session-detail-circuit">
                {
                  selectedSession
                    .meeting.circuit
                }
              </div>

              <div className="session-detail-grid">
                <div>
                  <div className="stat-label">
                    Start
                  </div>

                  <div className="stat-value">
                    {formatSessionDate(
                      selectedSession
                        .session
                        .startDate
                    )}
                  </div>
                </div>

                <div>
                  <div className="stat-label">
                    End
                  </div>

                  <div className="stat-value">
                    {formatSessionDate(
                      selectedSession
                        .session
                        .endDate
                    )}
                  </div>
                </div>
              </div>

              {sessionPreview?.message && (
                <div className="session-preview-message">
                  {
                    sessionPreview.message
                  }
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}