
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  {
    label: "Live Timing",
    href: "/",
    icon: (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l3 2" />
      </svg>
    ),
  },
  {
    label: "Schedule",
    href: "/schedule",
    icon: (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <rect x="3.5" y="5" width="17" height="15" rx="2" />
        <path d="M7 3v4M17 3v4M3.5 9h17" />
        <path d="M7.5 13h2M14.5 13h2M7.5 17h2M14.5 17h2" />
      </svg>
    ),
  },

  // Future pages:
  // {
  //   label: "Standings",
  //   href: "/standings",
  //   icon: (
  //     <svg viewBox="0 0 24 24" ...>
  //       ...
  //     </svg>
  //   ),
  // },
];

export default function AppNavigation() {
  const pathname = usePathname();

  return (
    <aside className="app-navigation">
      <div className="app-navigation-inner">

        <div className="app-navigation-brand">
        <span className="app-navigation-brand-mark" aria-hidden="true">
        <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* Flag pole */}
            <path
            d="M5 3.5V21"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            />

            {/* Flag outline */}
            <path
            d="M6 4.5C9 3 12 6 15 4.5C17 3.5 19 4 21 5V15.5C18.5 14.5 17 14.5 15 15.5C12 17 9 14 6 15.5V4.5Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinejoin="round"
            />

            {/* Checker cutouts */}
            <path
            d="M8 6.1H10.2V8.3H8V6.1ZM12.4 6.1H14.6V8.3H12.4V6.1ZM17 6.1H19.2V8.3H17V6.1ZM10.2 8.3H12.4V10.5H10.2V8.3ZM14.6 8.3H17V10.5H14.6V8.3ZM8 10.5H10.2V12.7H8V10.5ZM12.4 10.5H14.6V12.7H12.4V10.5ZM17 10.5H19.2V12.7H17V10.5ZM10.2 12.7H12.4V14.2H10.2V12.7ZM14.6 12.7H17V14H14.6V12.7Z"
            fill="#0b1220"
            />
        </svg>
        </span>

          <span className="app-navigation-brand-text">
            F1 LIVE
          </span>
        </div>

        <nav
          className="app-navigation-menu"
          aria-label="Main navigation"
        >
          {navigation.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`app-navigation-link ${
                  isActive ? "active" : ""
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="app-navigation-icon">
                  {item.icon}
                </span>

                <span className="app-navigation-label">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

