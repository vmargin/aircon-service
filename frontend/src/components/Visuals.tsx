import type { CSSProperties } from "react";
export function Avatar({
  name,
  small = false,
}: {
  name: string;
  small?: boolean;
}) {
  const colors = ["#639aab", "#8c8c9d", "#9e8d79", "#6d9891"];
  const hash = [...name].reduce((n, c) => n + c.charCodeAt(0), 0);
  return (
    <span
      className={`avatar ${small ? "avatar-small" : ""}`}
      style={{ "--avatar-tone": colors[hash % colors.length] } as CSSProperties}
    >
      {name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0])
        .join("")}
    </span>
  );
}
export function PropertyThumb({
  name = "",
  large = false,
}: {
  name?: string;
  large?: boolean;
}) {
  const cafe = /caf|coffee|bistro/i.test(name);
  const house = /residence|home|villa/i.test(name);
  return (
    <span
      className={`property-thumb ${large ? "property-large" : ""} ${cafe ? "thumb-cafe" : house ? "thumb-house" : "thumb-office"}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 60 52">
        <path d="M0 38L60 36V52H0Z" fill="#63757b" />
        {cafe ? (
          <>
            <path d="M9 14H51V44H9Z" fill="#b8a99b" />
            <path d="M6 23H54L50 16H10Z" fill="#84674f" />
            <path d="M14 27H26V42H14ZM33 27H46V37H33Z" fill="#405666" />
            <path
              d="M18 16V23M28 16V23M38 16V23M48 16V23"
              stroke="#dbc3a9"
              strokeWidth="3"
            />
            <path d="M36 39H44V43H36Z" fill="#c2a98c" />
          </>
        ) : house ? (
          <>
            <path d="M10 26H52V45H10Z" fill="#d0d2ca" />
            <path d="M6 27L30 9L55 27Z" fill="#566f7b" />
            <path d="M17 30H25V38H17ZM36 30H46V38H36Z" fill="#47616c" />
            <path d="M27 32H34V45H27Z" fill="#8c7866" />
            <path d="M6 45H54" stroke="#a4b7ae" strokeWidth="3" />
          </>
        ) : (
          <>
            <path d="M10 12H30V45H10Z" fill="#acb8bd" />
            <path d="M31 6H51V45H31Z" fill="#889faa" />
            {[16, 23, 30, 37].map((y) => (
              <path
                key={y}
                d={`M14 ${y}H26M35 ${y - 4}H47`}
                stroke="#466271"
                strokeWidth="4"
              />
            ))}
            <path d="M7 45H55" stroke="#d1d8d7" strokeWidth="2" />
          </>
        )}
        <path d="M3 41V31M56 41V28" stroke="#6b9b83" strokeWidth="4" />
      </svg>
    </span>
  );
}
