"use client";

import { useEffect, useState } from "react";

type Driver = {
  number: number;
  abbreviation: string | null;
  name: string | null;
  team: string | null;
  teamColour: string | null;
  position: number | null;
  gap: string | null;
  lastLap: string | null;
  bestLap: string | null;
  tyre: string | null;
  pit: string | null;
  pitStops: number;
  sectors?: {
    s1?: {
      time: string | null;
      status: number | null;
      personalFastest: boolean;
      overallFastest: boolean;
    };
    s2?: {
      time: string | null;
      status: number | null;
      personalFastest: boolean;
      overallFastest: boolean;
    };
    s3?: {
      time: string | null;
      status: number | null;
      personalFastest: boolean;
      overallFastest: boolean;
    };
  };
};

type Session = {
  name: string | null;
  type: string | null;
  status: string | null;
  trackStatus: string | null;
  lap: number | null;
  totalLaps: number | null;
  meetingName: string | null;
  location: string | null;
  circuit: string | null;
  startDate: string | null;
  endDate: string | null;
};

type RaceControlMessage = {
  id: string;
  category: string | null;
  message: string | null;
  flag: string | null;
  scope?: string | null;
  sector?: string | null;
  racingNumber?: string | null;
  status?: string | null;
  mode?: string | null;
  severity:
    | "red"
    | "safety-car"
    | "yellow"
    | "penalty"
    | "drs"
    | "clear"
    | "info"
    | "blue"
    | "track-limits";
  lap: number | null;
  timestamp: string | null;
};

type Snapshot = {
  session: Session;
  drivers: Driver[];
  raceControl: RaceControlMessage[];
};

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

const EMPTY_SNAPSHOT: Snapshot = {
  session: {
    name: null,
    type: null,
    status: null,
    trackStatus: null,
    lap: null,
    totalLaps: null,
    meetingName: null,
    location: null,
    circuit: null,
    startDate: null,
    endDate: null,
  },
  drivers: [],
  raceControl: [],
};

function formatCountdown(milliseconds: number) {
  if (milliseconds <= 0) {
    return "00:00:00";
  }

  const totalSeconds = Math.floor(milliseconds / 1000);

  const days = Math.floor(totalSeconds / 86400);

  const hours = Math.floor(
    (totalSeconds % 86400) / 3600
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );

  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}D ${String(hours).padStart(
      2,
      "0"
    )}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(hours).padStart(
    2,
    "0"
  )}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
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

function getTyreClass(tyre: string | null) {
  if (!tyre) {
    return "tyre-unknown";
  }

  const normalized = tyre.toLowerCase();

  if (normalized.includes("soft")) {
    return "tyre-soft";
  }

  if (normalized.includes("medium")) {
    return "tyre-medium";
  }

  if (normalized.includes("hard")) {
    return "tyre-hard";
  }

  if (
    normalized.includes("intermediate") ||
    normalized === "inter"
  ) {
    return "tyre-intermediate";
  }

  if (
    normalized.includes("wet") ||
    normalized.includes("full wet")
  ) {
    return "tyre-wet";
  }

  return "tyre-unknown";
}

function getRaceControlClass(
  severity: RaceControlMessage["severity"]
) {
  switch (severity) {
    case "red":
      return "race-control-red";

    case "safety-car":
      return "race-control-safety";

    case "yellow":
      return "race-control-yellow";

    case "penalty":
      return "race-control-penalty";

    case "drs":
      return "race-control-drs";

    case "clear":
      return "race-control-clear";

    case "blue":
      return "race-control-blue";

    case "track-limits":
      return "race-control-track-limits";

    default:
      return "race-control-info";
  }
}

function getRaceControlLabel(
  severity: RaceControlMessage["severity"]
) {
  switch (severity) {
    case "red":
      return "RED FLAG";

    case "safety-car":
      return "SAFETY CAR";

    case "yellow":
      return "YELLOW";

    case "penalty":
      return "STEWARDS";

    case "drs":
      return "DRS";

    case "clear":
      return "ALL CLEAR";

    case "blue":
      return "BLUE FLAG";

    case "track-limits":
      return "TRACK LIMITS";

    default:
      return "INFO";
  }
}

type RawDriver = Omit<Driver, "sectors"> & {
  sectors?: Array<{
    time: string | null;
    status: number | null;
    personalFastest: boolean;
    overallFastest: boolean;
  }>;
};

type RawSnapshot = Omit<Snapshot, "drivers"> & {
  drivers: RawDriver[];
};

export default function Home() {
  const [snapshot, setSnapshot] =
    useState<Snapshot>(EMPTY_SNAPSHOT);

  const [connected, setConnected] =
    useState(false);

  const [nextSession, setNextSession] =
    useState<NextSession | null>(null);

  const [countdown, setCountdown] =
    useState("--:--:--");

  const [selectedDriver, setSelectedDriver] =
    useState<Driver | null>(null);

  useEffect(() => {
    let socket: WebSocket | null = null;

    let reconnectTimer: ReturnType<
      typeof setTimeout
    >;

    let shouldReconnect = true;

    const connect = () => {
      socket = new WebSocket(
        "ws://localhost:8000/ws/live"
      );

      socket.onopen = () => {
        console.log("Connected to F1 API");
        setConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const data: RawSnapshot =
            JSON.parse(event.data);

          const normalizedDrivers: Driver[] =
            (data.drivers ?? []).map((driver) => ({
              ...driver,

              sectors: {
                s1: driver.sectors?.[0]
                  ? {
                      time:
                        driver.sectors[0].time ??
                        null,
                      status:
                        driver.sectors[0].status ??
                        null,
                      personalFastest:
                        driver.sectors[0]
                          .personalFastest ??
                        false,
                      overallFastest:
                        driver.sectors[0]
                          .overallFastest ??
                        false,
                    }
                  : undefined,

                s2: driver.sectors?.[1]
                  ? {
                      time:
                        driver.sectors[1].time ??
                        null,
                      status:
                        driver.sectors[1].status ??
                        null,
                      personalFastest:
                        driver.sectors[1]
                          .personalFastest ??
                        false,
                      overallFastest:
                        driver.sectors[1]
                          .overallFastest ??
                        false,
                    }
                  : undefined,

                s3: driver.sectors?.[2]
                  ? {
                      time:
                        driver.sectors[2].time ??
                        null,
                      status:
                        driver.sectors[2].status ??
                        null,
                      personalFastest:
                        driver.sectors[2]
                          .personalFastest ??
                        false,
                      overallFastest:
                        driver.sectors[2]
                          .overallFastest ??
                        false,
                    }
                  : undefined,
              },
            }));

          console.log(
            "SECTOR FLAGS",
            normalizedDrivers.map((driver) => ({
              driver: driver.abbreviation,
              s1: driver.sectors?.s1,
              s2: driver.sectors?.s2,
              s3: driver.sectors?.s3,
            }))
          );

          setSnapshot({
            ...data,
            drivers: normalizedDrivers,
          });
        } catch (error) {
          console.error(
            "Invalid F1 snapshot:",
            error
          );
        }
      };

      socket.onclose = () => {
        console.log(
          "Disconnected from F1 API"
        );

        setConnected(false);

        if (!shouldReconnect) {
          return;
        }

        reconnectTimer = setTimeout(() => {
          connect();
        }, 3000);
      };

      socket.onerror = () => {
        setConnected(false);
      };
    };

    connect();

    return () => {
      shouldReconnect = false;
      clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  useEffect(() => {
    const loadNextSession = async () => {
      try {
        const response = await fetch(
          "http://localhost:8000/schedule/next"
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

    loadNextSession();

    const interval = setInterval(
      loadNextSession,
      60000
    );

    return () => clearInterval(interval);
  }, []);

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

  useEffect(() => {
    if (selectedDriver) {
      document.body.style.overflow =
        "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedDriver]);

  const {
    session,
    drivers,
    raceControl,
  } = snapshot;

  const isLive =
    session.status === "Started" ||
    session.status === "Running";

  const hasCurrentSession =
    Boolean(session.name) &&
    Boolean(session.startDate);

  const showCurrentSession =
    isLive ||
    (hasCurrentSession &&
      session.status === "Ends");

  const sessionType =
    showCurrentSession
      ? session.type
      : nextSession?.type || "";

  const isRace =
    sessionType === "Race";

  const isQualifying =
    sessionType === "Qualifying";

  const isPractice =
    sessionType === "Practice";

  const displayMeetingName =
    showCurrentSession
      ? session.meetingName
      : nextSession?.meetingName;

  const displayCircuit =
    showCurrentSession
      ? session.circuit ||
        session.location
      : nextSession?.circuit;

  const displaySessionType =
    showCurrentSession
      ? session.type
      : nextSession?.type ||
        nextSession?.name;

  return (
    <main className="page">
      <div className="container">
        <header className="header schedule-page-header">
          <div>
            <div className="logo">
              F1 LIVE
            </div>

            <div className="schedule-page-subtitle">
              Live Timing
            </div>
          </div>

          <div className="live-indicator">
            <span
              className={`live-dot ${
                isLive
                  ? "live"
                  : connected
                  ? "next"
                  : "offline"
              }`}
            />

            {isLive
              ? "Live"
              : connected
              ? "No Session"
              : "Offline"}
          </div>
        </header>

        <section className="session-card live-timing-card">
          <div className="live-session-banner">
            <div className="live-session-banner-left">
              <div className="schedule-section-eyebrow">
                {isLive
                  ? "SESSION"
                  : "LAST SESSION"}
              </div>

              <div className="panel-title">
                {showCurrentSession
                  ? displaySessionType ||
                    "Session"
                  : "No Current Session"}
              </div>

              <div className="live-session-name">
                {showCurrentSession
                  ? displayMeetingName ||
                    "F1"
                  : "Waiting for session"}
              </div>

              <div className="live-session-location">
                {showCurrentSession
                  ? displayCircuit ||
                    "—"
                  : "—"}
              </div>

              {showCurrentSession && (
                <div className="live-session-meta">
                  <span>
                    {isLive
                      ? "ONGOING"
                      : "FINISHED"}
                  </span>

                  {session.startDate && (
                    <>
                      <span className="live-session-meta-divider">
                        •
                      </span>

                      <span>
                        {formatSessionDate(
                          session.startDate
                        )}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="live-session-banner-right">
              <div className="schedule-section-eyebrow">
                {isLive
                  ? "LIVE"
                  : "NEXT SESSION"}
              </div>

              {isLive ? (
                <>
                  <div className="live-session-next-type">
                    {session.type ||
                      "Session"}
                  </div>

                  <div className="live-session-next-name">
                    {session.meetingName ||
                      "F1"}
                  </div>

                  <div className="live-session-next-location">
                    {session.circuit ||
                      session.location ||
                      "—"}
                  </div>

                  <div className="live-session-next-countdown-label">
                    ONGOING
                  </div>

                  <div className="live-session-live-status">
                    LIVE
                  </div>

                  {session.totalLaps !==
                    null && (
                    <div className="live-session-laps">
                      LAP{" "}
                      {session.lap ?? "—"} /{" "}
                      {session.totalLaps}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="live-session-next-type">
                    {nextSession?.type ||
                      nextSession?.name ||
                      "Session"}
                  </div>

                  <div className="live-session-next-name">
                    {nextSession?.meetingName ||
                      "No upcoming session"}
                  </div>

                  <div className="live-session-next-location">
                    {nextSession?.circuit ||
                      nextSession?.location ||
                      "—"}
                  </div>

                  <div className="live-session-next-countdown-label">
                    STARTS IN
                  </div>

                  <div className="schedule-calendar-next-countdown">
                    {countdown}
                  </div>

                  {nextSession && (
                    <div className="live-session-start-date">
                      {formatSessionDate(
                        nextSession.startDate
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="content-grid">
            <section className="panel">
              <div className="panel-header">
                <div className="panel-title">
                  {isRace
                    ? "Race Timing"
                    : isQualifying
                    ? "Qualifying Timing"
                    : isPractice
                    ? "Practice Timing"
                    : "Session Timing"}
                </div>

                <div className="live-indicator">
                  {`${drivers.length} drivers`}
                </div>
              </div>

              <div
                className={
                  isRace &&
                  drivers.length > 10
                    ? "timing-table-scroll timing-table-scrollable"
                    : "timing-table-scroll"
                }
              >
                <div className="timing-table-horizontal">
                  <table
                    className={`timing-table ${
                      isRace
                        ? "timing-table-race"
                        : "timing-table-practice"
                    }`}
                  >
                    <thead>
                      <tr>
                        <th>Pos</th>
                        <th>Driver</th>

                        {isRace ? (
                          <>
                            <th>Gap</th>

                            <th className="mobile-hide">
                              Last Lap
                            </th>
                          </>
                        ) : (
                          <>
                            <th>Last Lap</th>

                            <th className="mobile-hide">
                              S1
                            </th>

                            <th className="mobile-hide">
                              S2
                            </th>

                            <th className="mobile-hide">
                              S3
                            </th>
                          </>
                        )}

                        <th className="mobile-hide">
                          Best Lap
                        </th>

                        <th>
                          {isRace
                            ? "Tyre"
                            : "Status"}
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {drivers.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="placeholder-row"
                          >
                            {isLive
                              ? "Waiting for live timing data..."
                              : "No live session"}
                          </td>
                        </tr>
                      ) : (
                        drivers.map((driver) => (
                          <tr
                            key={driver.number}
                            className={`driver-row ${
                              driver.position ===
                              1
                                ? "leader-row"
                                : ""
                            } ${
                              selectedDriver?.number ===
                              driver.number
                                ? "selected-driver-row"
                                : ""
                            }`}
                            onClick={() =>
                              setSelectedDriver(
                                driver
                              )
                            }
                          >
                            <td className="position">
                              <div className="position-wrapper">
                                {driver.position ===
                                  1 && (
                                  <span className="leader-indicator">
                                    ●
                                  </span>
                                )}

                                {driver.position ??
                                  "—"}
                              </div>
                            </td>

                            <td>
                              <div className="driver-cell">
                                <span
                                  className="driver-color"
                                  style={{
                                    backgroundColor:
                                      driver.teamColour ||
                                      "var(--border)",
                                  }}
                                />

                                <div>
                                  <div className="driver-name">
                                    {driver.abbreviation ||
                                      driver.name ||
                                      `#${driver.number}`}
                                  </div>

                                  <div className="driver-team">
                                    {driver.team ||
                                      "—"}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="gap">
                              {isRace
                                ? driver.position ===
                                  1
                                  ? "LEADER"
                                  : driver.gap ||
                                    "—"
                                : driver.lastLap ||
                                  "—"}
                            </td>

                            {isRace ? (
                              <td className="lap-time mobile-hide">
                                {driver.lastLap ||
                                  "—"}

                                {driver.pit && (
                                  <div className="pit-badge">
                                    PIT{" "}
                                    {driver.pit}
                                  </div>
                                )}
                              </td>
                            ) : (
                              <>
                                <td className="lap-time mobile-hide">
                                  <div className="sector-cell">
                                    <span>
                                      {driver
                                        .sectors
                                        ?.s1
                                        ?.time ||
                                        "—"}
                                    </span>
                                  </div>
                                </td>

                                <td className="lap-time mobile-hide">
                                  <div className="sector-cell">
                                    <span>
                                      {driver
                                        .sectors
                                        ?.s2
                                        ?.time ||
                                        "—"}
                                    </span>
                                  </div>
                                </td>

                                <td className="lap-time mobile-hide">
                                  <div className="sector-cell">
                                    <span>
                                      {driver
                                        .sectors
                                        ?.s3
                                        ?.time ||
                                        "—"}
                                    </span>
                                  </div>
                                </td>
                              </>
                            )}

                            <td className="lap-time mobile-hide">
                              {driver.bestLap ||
                                "—"}
                            </td>

                            <td>
                              {isRace ? (
                                <span
                                  className={`tyre ${getTyreClass(
                                    driver.tyre
                                  )}`}
                                >
                                  <span className="tyre-dot" />

                                  <span>
                                    {driver.tyre ||
                                      "—"}
                                  </span>
                                </span>
                              ) : (
                                <span>
                                  {driver.pit ||
                                    "—"}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedDriver && (
                <div
                  className="driver-modal-backdrop"
                  onClick={() =>
                    setSelectedDriver(null)
                  }
                >
                  <div
                    className="driver-modal"
                    onClick={(event) =>
                      event.stopPropagation()
                    }
                  >
                    <div className="driver-detail">
                      <div className="driver-detail-header">
                        <div className="driver-detail-identity">
                          <div className="driver-detail-abbreviation">
                            {
                              selectedDriver.abbreviation
                            }

                            <span className="driver-detail-number">
                              #
                              {
                                selectedDriver.number
                              }
                            </span>
                          </div>

                          <div className="driver-detail-name">
                            {
                              selectedDriver.name
                            }
                          </div>

                          <div className="driver-detail-team">
                            {
                              selectedDriver.team
                            }
                          </div>

                          <div className="driver-detail-session">
                            {displaySessionType
                              ? `${displaySessionType} • ${
                                  displayMeetingName ||
                                  ""
                                }`
                              : "Session"}
                          </div>
                        </div>

                        <div className="driver-detail-position">
                          <span className="stat-label">
                            POS
                          </span>

                          <strong>
                            {selectedDriver.position ||
                              "—"}
                          </strong>
                        </div>

                        <button
                          type="button"
                          className="driver-detail-close"
                          onClick={() =>
                            setSelectedDriver(
                              null
                            )
                          }
                        >
                          ×
                        </button>
                      </div>

                      <div className="driver-detail-grid">
                        {isRace ? (
                          <div>
                            <div className="stat-label">
                              Gap
                            </div>

                            <div className="stat-value">
                              {selectedDriver.position ===
                              1
                                ? "LEADER"
                                : selectedDriver.gap ||
                                  "—"}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="stat-label">
                              Best Lap
                            </div>

                            <div className="stat-value">
                              {selectedDriver.bestLap ||
                                "—"}
                            </div>
                          </div>
                        )}

                        <div>
                          <div className="stat-label">
                            Last Lap
                          </div>

                          <div className="stat-value">
                            {selectedDriver.lastLap ||
                              "—"}
                          </div>
                        </div>

                        <div>
                          <div className="stat-label">
                            Tyre
                          </div>

                          <div className="stat-value">
                            {selectedDriver.tyre ||
                              "—"}
                          </div>
                        </div>

                        <div>
                          <div className="stat-label">
                            Pit Stops
                          </div>

                          <div className="stat-value">
                            {selectedDriver.pitStops ??
                              0}
                          </div>
                        </div>

                        <div>
                          <div className="stat-label">
                            Pit Status
                          </div>

                          <div className="stat-value">
                            {selectedDriver.pit ||
                              "Track"}
                          </div>
                        </div>
                      </div>

                      {selectedDriver.sectors && (
                        <div className="driver-sectors">
                          <div className="driver-detail-section-title">
                            Sectors
                          </div>

                          <div className="sector-grid">
                            <div>
                              <span>
                                Sector 1
                              </span>

                              <strong>
                                {selectedDriver
                                  .sectors
                                  .s1
                                  ?.time ||
                                  "—"}
                              </strong>

                              {selectedDriver
                                .sectors.s1
                                ?.overallFastest && (
                                <small className="sector-best">
                                  BEST
                                </small>
                              )}

                              {!selectedDriver
                                .sectors.s1
                                ?.overallFastest &&
                                selectedDriver
                                  .sectors.s1
                                  ?.personalFastest && (
                                  <small className="sector-personal">
                                    PERSONAL
                                  </small>
                                )}
                            </div>

                            <div>
                              <span>
                                Sector 2
                              </span>

                              <strong>
                                {selectedDriver
                                  .sectors
                                  .s2
                                  ?.time ||
                                  "—"}
                              </strong>

                              {selectedDriver
                                .sectors.s2
                                ?.overallFastest && (
                                <small className="sector-best">
                                  BEST
                                </small>
                              )}

                              {!selectedDriver
                                .sectors.s2
                                ?.overallFastest &&
                                selectedDriver
                                  .sectors.s2
                                  ?.personalFastest && (
                                  <small className="sector-personal">
                                    PERSONAL
                                  </small>
                                )}
                            </div>

                            <div>
                              <span>
                                Sector 3
                              </span>

                              <strong>
                                {selectedDriver
                                  .sectors
                                  .s3
                                  ?.time ||
                                  "—"}
                              </strong>

                              {selectedDriver
                                .sectors.s3
                                ?.overallFastest && (
                                <small className="sector-best">
                                  BEST
                                </small>
                              )}

                              {!selectedDriver
                                .sectors.s3
                                ?.overallFastest &&
                                selectedDriver
                                  .sectors.s3
                                  ?.personalFastest && (
                                  <small className="sector-personal">
                                    PERSONAL
                                  </small>
                                )}
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedDriver.pit && (
                        <div className="driver-pit-status">
                          Currently in pit lane
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <aside>
              <section className="panel sidebar-panel">
                <div className="panel-header">
                  <div className="panel-title">
                    Race Control
                  </div>
                </div>

                <div className="race-control">
                  {raceControl.length === 0 ? (
                    <div className="schedule-empty">
                      No race control messages
                    </div>
                  ) : (
                    raceControl
                      .slice()
                      .reverse()
                      .map((message) => (
                        <div
                          key={message.id}
                          className={`control-message ${getRaceControlClass(
                            message.severity
                          )}`}
                        >
                          <div className="control-message-header">
                            <div className="control-message-type">
                              <span className="control-message-indicator" />

                              {getRaceControlLabel(
                                message.severity
                              )}
                            </div>

                            {message.lap !==
                              null && (
                              <div className="control-lap">
                                LAP{" "}
                                {message.lap}
                              </div>
                            )}
                          </div>

                          <div className="control-text">
                            {message.message ||
                              "Race control update"}
                          </div>

                          {(message.racingNumber ||
                            message.sector ||
                            message.flag) && (
                            <div className="control-meta">
                              {message.racingNumber && (
                                <span>
                                  CAR #
                                  {
                                    message.racingNumber
                                  }
                                </span>
                              )}

                              {message.sector && (
                                <span>
                                  SECTOR{" "}
                                  {
                                    message.sector
                                  }
                                </span>
                              )}

                              {message.flag && (
                                <span>
                                  FLAG:{" "}
                                  {
                                    message.flag
                                  }
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                  )}
                </div>
              </section>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

