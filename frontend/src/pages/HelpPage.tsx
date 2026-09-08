import { Fragment, ReactNode, useEffect, useState } from "react";
import { SHORTCUTS, formatCombo } from "../shortcuts";
import { useShortcutSettings } from "../useShortcuts";
import { useLanguage, Language } from "../i18n";
import { RU } from "../i18n/ru";
import { HelpIcon } from "../components/Icon";

/** A single key/combo badge — always formatted for the viewer's own OS (⌥/⌘ on Mac, Alt/Ctrl
 *  elsewhere; ⏎/⎋ on Mac, Enter/Esc elsewhere), same as every other combo shown in the app. */
function Key({ combo }: { combo: string }) {
  return <kbd className="kbd">{formatCombo(combo)}</kbd>;
}

/** A key badge for a registered shortcut, by id — reads the viewer's own current binding (not just
 *  the default), so this page and the settings panel never disagree after a rebind. */
function HotkeyBadge({ id }: { id: string }) {
  const { effectiveCombo } = useShortcutSettings();
  const combo = effectiveCombo(id);
  return combo ? <Key combo={combo} /> : null;
}

function groupShortcuts() {
  const order: string[] = [];
  const byGroup = new Map<string, typeof SHORTCUTS>();
  for (const s of SHORTCUTS) {
    if (!byGroup.has(s.group)) {
      byGroup.set(s.group, []);
      order.push(s.group);
    }
    byGroup.get(s.group)!.push(s);
  }
  return order.map((group) => ({ group, items: byGroup.get(group)! }));
}
const GROUPED = groupShortcuts();

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="help-section" id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

/** A titled sub-block inside a Section — used to split "Keyboard shortcuts" into its own walkthrough/
 *  reference/customizing pieces without each one reading as a top-level section of its own. */
function Subsection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="help-subsection">
      <h3 className="help-subsection-title">{title}</h3>
      {children}
    </div>
  );
}

/** One step of the walkthrough — a numbered heading plus a list of bullet points, each of which
 *  may mix plain text with <Key>/<HotkeyBadge> badges. */
function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="help-step">
      <div className="help-step-head">
        <span className="help-step-n">{n}</span>
        <h3>{title}</h3>
      </div>
      <ul>{children}</ul>
    </div>
  );
}

export function HelpPage() {
  // Deliberately its own local language state, seeded from the app's current setting but never
  // written back to it (no shared LanguageProvider here) — this page opens in its own browser tab
  // (see TopTabs' Help button), and flipping RUS/ENG here shouldn't also flip every other open tab.
  const { language: appLanguage } = useLanguage();
  const [language, setLanguage] = useState<Language>(appLanguage);
  const t = (text: string) => (language === "en" ? text : RU[text] ?? text);

  // This page is a real standalone browser tab (see TopTabs' Help button, target="_blank"), unlike
  // every other screen — those live inside the app's own tab strip under index.html's static title.
  useEffect(() => {
    document.title = "DCS - Help";
  }, []);

  const TOC: { id: string; label: string }[] = [
    { id: "overview", label: t("Overview") },
    { id: "flights", label: t("Flights") },
    { id: "checkin-guide", label: t("Check-in") },
    { id: "boarding-guide", label: t("Boarding") },
    { id: "admin", label: t("Admin & Analytics") },
    { id: "settings", label: t("Settings") },
    { id: "shortcuts", label: t("Keyboard shortcuts") },
  ];

  return (
    <div className="help-page">
      <div className="help-page-header">
        <div className="help-page-title">
          <HelpIcon size={22} />
          <h1>{t("DCS User Guide")}</h1>
        </div>
        <div className="user-panel-theme-toggle">
          {(["ru", "en"] as Language[]).map((l) => (
            <button key={l} type="button" className={language === l ? "selected" : ""} onClick={() => setLanguage(l)}>
              {l === "ru" ? "RUS" : "ENG"}
            </button>
          ))}
        </div>
      </div>

      <p className="help-intro">
        {t(
          "A Departure Control System for check-in and boarding agents: build and manage the day's flights, check passengers in, and board them at the gate. This page covers every screen, plus a full keyboard-shortcut reference at the end."
        )}
      </p>
      <nav className="help-toc" aria-label={t("On this page")}>
        {TOC.map((item) => (
          <a key={item.id} href={`#${item.id}`}>{item.label}</a>
        ))}
      </nav>

      <Section id="overview" title={t("Overview")}>
        <p>
          {t(
            "The sidebar (left) is the same on every screen: Flights, Check-in, Boarding, and — for superadmins only — UX Analytics and User administration. While you're inside a check-in flow, the sidebar also grows shortcut icons for the current Documents/Seats/Baggage/Extra services step, Cart and Flight information, so you don't have to go back to the flow header for them."
          )}
        </p>
        <p>
          {t(
            "Across the top, every screen you open stays as its own tab in the strip — closable, reopenable (the ↺ icon bottom-left brings back the last closed one), and independent of your browser's own tabs. The top-right corner has the current time, this Help page, an internal Messenger for reaching other agents, and your account menu (avatar) with Settings and sign-out."
          )}
        </p>
        <p>
          {t(
            "A test account without edit rights sees a banner across the top of every screen and can look around freely, but every change is blocked — the same restriction the backend itself enforces, not just the UI hiding buttons."
          )}
        </p>
      </Section>

      <Section id="flights" title={t("Flights")}>
        <p>
          {t(
            "The Flights board (the plane icon, and where the app opens) lists every flight, defaulting to today's. Search by airline/flight number/route/date range, or use the quick filter fields directly above the table; every column sorts by clicking its header."
          )}
        </p>
        <p>
          {t(
            "Opening a flight (click its row) gives you its full card: Main (schedule, aircraft, status), Counters, Pax, Transfers and Settings tabs. \"New flight\" builds one from scratch — segments, codeshare/interline/own agreement, and the same boarding-control checklist shown on the card's own Main tab."
          )}
        </p>
      </Section>

      <Section id="checkin-guide" title={t("Check-in")}>
        <p>
          {t(
            "Check-in Search (the person-with-magnifier icon) finds a booking by Last Name, PNR, E-ticket, Document number or Flight. Opening a result lands you on that PNR's roster — every passenger on the booking, checked-in or not."
          )}
        </p>
        <p>
          {t(
            "Check the passengers you want and press Check-in to start the flow for all of them together (a family or group checks in as one pass, not one at a time). The flow has four steps — Documents, Seats, Baggage, Extra services — reachable in order or, once unlocked, directly; Cart and Flight information open as side panels from the same header. Finish leaves the flow at any point; the flow's own Check-in button only lights up once Documents and Seats are behind you."
          )}
        </p>
        <p>
          {t(
            "The roster's Actions menu covers what isn't a step of its own: printing a boarding pass, moving a passenger to another flight, the priority list, adding or removing a remark, and transferring."
          )}
        </p>
      </Section>

      <Section id="boarding-guide" title={t("Boarding")}>
        <p>
          {t(
            "Boarding Search (the boarding-pass icon) lists every flight currently open for check-in or boarding; opening one takes you to its passenger list. Scan a boarding pass, or check rows and Board/Offload them directly — Board only works once the flight's own Start boarding has been pressed, and Close flight ends boarding and marks anyone still not boarded as a no-show. PNL and PFS open the passenger/preliminary flight manifests."
          )}
        </p>
        <p>
          {t(
            "Opening a single passenger (click their row) shows their status next to the real seat map — for reference only here, picking a seat doesn't reassign it. Board, Unboard, Pay (once a service payment is outstanding) and Reprint BP act on that one passenger; the same Documents/Seats/Baggage/Extra services icons as check-in jump straight to that passenger's own flow, opened as a new tab in this app rather than a real browser tab."
          )}
        </p>
      </Section>

      <Section id="admin" title={t("Admin & Analytics")}>
        <p>
          {t(
            "Both of these are superadmin-only and only appear in the sidebar for that role. User administration adds, edits and deactivates accounts — role (user/superadmin) and the per-user can_edit flag, which is what actually decides whether a regular user can change anything or only look (a superadmin can always edit)."
          )}
        </p>
        <p>
          {t(
            "UX Analytics reads back what the app has been quietly recording as agents use it — page views, actions, which keyboard shortcuts actually get used, and JS/API errors — as a dashboard rather than raw logs."
          )}
        </p>
      </Section>

      <Section id="settings" title={t("Settings")}>
        <p>
          {t(
            "Open your account menu (top-right avatar) → Settings for: interface language (RUS/ENG) and theme (Light/Dark) plus a high-contrast option, font size, whether tabs show a small icon for their section, this app's own desktop notifications for new Messenger messages, and your timezone. \"Show keyboard shortcuts\" is the one most relevant to this page — it puts a small always-visible combo badge on every shortcut-bound button, not just this reference. The same menu has a Keyboard shortcuts section for rebinding any Alt/Ctrl combo, and a Security section for changing your password."
          )}
        </p>
      </Section>

      <Section id="shortcuts" title={t("Keyboard shortcuts")}>
      <p className="help-intro">
        {t(
          "This app can be driven almost entirely from the keyboard. Two kinds of shortcuts are used throughout, and both are shown here exactly as they work on your own operating system:"
        )}
      </p>
      <ul className="help-intro-list">
        <li>
          {t(
            "Fixed combos (Alt/Ctrl + a key) for one-off actions — Confirm, Add, Verify, switching steps. These work the same everywhere in the app and can be rebound from Settings → Keyboard shortcuts."
          )}
        </li>
        <li>
          {t(
            "Arrow keys, Enter, Space and Escape for moving between and operating on items in a list or a row — seats, roster rows, document cards, baggage and service rows. These are fixed and the same on every OS; Tab alone isn't relied on to reach them, since whether Tab even stops on a button is a browser setting outside this app's control (Safari in particular skips buttons unless Full Keyboard Access is turned on)."
          )}
        </li>
      </ul>
      <p className="help-intro">
        {t('Turn on "Show keyboard shortcuts" in Settings (account menu) to see each shortcut next to its own button as a tooltip.')}
      </p>

      <Subsection title={t("Check-in — step by step")}>
        <Step n={1} title={t("Check-in Search")}>
          <li>{t("Open the Check-in Search tab from anywhere")} — <HotkeyBadge id="nav.checkin-search" /></li>
          <li>{t("Jump straight into the search field")} — <Key combo="/" /></li>
          <li>{t("Switch between Last Name / PNR / E-ticket / Doc / Flight with a click, or Tab to them")}</li>
          <li>{t("Press Enter in the field, or click Search")}</li>
        </Step>

        <Step n={2} title={t("Passenger roster (before check-in)")}>
          <li>{t("Tab reaches exactly one roster row at a time")}</li>
          <li>
            {t("Move between rows")} — <Key combo="arrowup" /> <Key combo="arrowdown" />
          </li>
          <li>
            {t("Check or uncheck that row's box")} — <Key combo="enter" /> <Key combo="space" />
          </li>
          <li>{t("Start check-in for every checked, not-yet-checked-in passenger")} — <HotkeyBadge id="checkin.start" /></li>
          <li>{t("Open the Actions menu (Quick check-in, Cancel check-in, Move to another flight, and more)")} — <HotkeyBadge id="checkin.actions-menu" /></li>
          <li>{t("Add a passenger")} — <HotkeyBadge id="checkin.add-pax" /></li>
        </Step>

        <Step n={3} title={t("Check-in flow header")}>
          <li>
            {t("Switch passengers within the same flow — a family or group PNR — without leaving the current step")} —{" "}
            <HotkeyBadge id="flow.prev-passenger" /> / <HotkeyBadge id="flow.next-passenger" />
          </li>
          <li>
            {t("Jump directly to a step once it's reachable")} — <HotkeyBadge id="flow.step-docs" /> {t("Documents")},{" "}
            <HotkeyBadge id="flow.step-seats" /> {t("Seats")}, <HotkeyBadge id="flow.step-baggage" /> {t("Baggage")},{" "}
            <HotkeyBadge id="flow.step-services" /> {t("Extra services")}
          </li>
          <li>{t("Next step")} — <HotkeyBadge id="flow.next" /></li>
          <li>{t("Finish")} — <HotkeyBadge id="flow.finish" /></li>
          <li>{t("Cart")} — <HotkeyBadge id="flow.cart" /></li>
          <li>{t("Flight information")} — <HotkeyBadge id="flow.flight-info" /></li>
          <li>
            {t("Complete check-in, once Documents and Seats are behind you")} — <HotkeyBadge id="flow.checkin" />
          </li>
        </Step>

        <Step n={4} title={t("Step 1 — Documents")}>
          <li>{t("DOCS / DOCO / DOCA tabs switch which document type is shown — click, or Tab to them")}</li>
          <li>{t("Document cards follow the same one-Tab-stop, arrow-key pattern as the roster")}</li>
          <li>{t("Verify docs on all segments")} — <HotkeyBadge id="flow.verify-docs" /></li>
          <li>{t("Add document")} — <HotkeyBadge id="flow.add-document" /></li>
          <li>
            {t("Inside the document editor, save with")} <Key combo="mod|enter" />
          </li>
        </Step>

        <Step n={5} title={t("Step 2 — Seats")}>
          <li>
            {t("Move the highlighted seat")} — <Key combo="arrowup" /> <Key combo="arrowdown" /> <Key combo="arrowleft" /> <Key combo="arrowright" />
          </li>
          <li>
            {t("Assign the highlighted seat, or complete a swap in progress")} — <Key combo="enter" /> <Key combo="space" />
          </li>
          <li>
            {t("Cancel a swap in progress")} — <Key combo="escape" />
          </li>
          <li>
            {t("Zoom in")} — <HotkeyBadge id="seatmap.zoom-in" />
          </li>
          <li>
            {t("Zoom out")} — <HotkeyBadge id="seatmap.zoom-out" />
          </li>
          <li>
            {t("Reset zoom to 100%")} — <HotkeyBadge id="seatmap.zoom-reset" />
          </li>
          <li>{t("Switch the seat map's layout orientation")} — <HotkeyBadge id="seatmap.rotate" /></li>
          <li>{t("Open the Legend")} — <HotkeyBadge id="seatmap.legend" /></li>
          <li>{t("Open Layers")} — <HotkeyBadge id="seatmap.layers" /></li>
          <li>
            {t("Close the Legend or Layers panel")} — <Key combo="escape" />
          </li>
        </Step>

        <Step n={6} title={t("Step 3 — Baggage")}>
          <li>{t("Add a baggage row")} — <HotkeyBadge id="baggage.add-row" /></li>
          <li>
            {t(
              "Within a row, the fields chain to each other without depending on Tab: from Weight, the arrow keys (or Enter) move into Destination and Type; ArrowLeft/ArrowRight step between Print tag and Remove"
            )}
          </li>
          <li>{t("Print the highlighted row's tag")} — <HotkeyBadge id="baggage.print-tag" /></li>
          <li>{t("Add a carry-on row")} — <HotkeyBadge id="baggage.add-carryon" /></li>
          <li>{t("Baggage allowance")} — <HotkeyBadge id="baggage.allowance" /></li>
          <li>{t("Calculate")} — <HotkeyBadge id="baggage.calculate" /></li>
          <li>{t("Confirm")} — <HotkeyBadge id="baggage.confirm" /></li>
        </Step>

        <Step n={7} title={t("Step 4 — Extra services")}>
          <li>{t("Tab reaches exactly one service's checkbox at a time")}</li>
          <li>
            {t("Move between rows")} — <Key combo="arrowup" /> <Key combo="arrowdown" />
          </li>
          <li>
            {t("Check or uncheck it")} — <Key combo="enter" /> <Key combo="space" />
          </li>
          <li>
            {t("Once checked, step into that row's own controls — the segment picker (connecting itineraries only), the quantity stepper, then Confirm")}{" "}
            — <Key combo="arrowright" />
          </li>
          <li>
            {t("Step back toward the checkbox")} — <Key combo="arrowleft" />
          </li>
          <li>{t("Confirm turns into the price — click it, or press Enter once it has focus, to see the EMD")}</li>
        </Step>

        <Step n={8} title={t("Finishing")}>
          <li>
            {t("Once every step is done")} — <HotkeyBadge id="flow.checkin" /> {t("or")} <HotkeyBadge id="flow.finish" />
          </li>
        </Step>
      </Subsection>

      <Subsection title={t("Boarding — step by step")}>
        <Step n={1} title={t("Boarding Search")}>
          <li>{t("Open Boarding Search from anywhere")} — <HotkeyBadge id="nav.boarding-search" /></li>
          <li>{t("Jump straight into the flight-number field")} — <Key combo="/" /></li>
          <li>
            {t("From the flight-number field, reach the Status/Departure/Arrival dropdowns")} — <Key combo="arrowdown" />, {t("then move between them")} — <Key combo="arrowleft" /> <Key combo="arrowright" />
          </li>
          <li>{t("Tab reaches exactly one result row at a time")}</li>
          <li>
            {t("Move between rows")} — <Key combo="arrowup" /> <Key combo="arrowdown" />, {t("open it")} — <Key combo="enter" />
          </li>
        </Step>

        <Step n={2} title={t("Passenger list")}>
          <li>{t("Jump straight into the search field")} — <Key combo="/" /></li>
          <li>{t("Toggle the scan-a-boarding-pass panel")} — <HotkeyBadge id="boarding.scan" /></li>
          <li>
            {t("Move the row cursor, independent of where Tab happens to be")} — <Key combo="arrowup" /> <Key combo="arrowdown" />
          </li>
          <li>
            {t("Open the row under the cursor")} — <Key combo="enter" />, {t("toggle its checkbox")} — <Key combo="space" />
          </li>
          <li>{t("Select/deselect every row")} — <HotkeyBadge id="boarding.select-all" /></li>
          <li>
            {t("Board the checked rows")} — <HotkeyBadge id="boarding.board" />, {t("offload them")} — <HotkeyBadge id="boarding.offload" />
          </li>
          <li className="help-note">
            {t("Board only works once boarding has actually been opened for this flight (Start boarding pressed) — it stays disabled, and its shortcut does nothing, until then")}
          </li>
          <li>{t("Start boarding, or close the flight once boarding")} — <HotkeyBadge id="boarding.start" /></li>
          <li>
            {t("Show the PNL")} — <HotkeyBadge id="boarding.pnl" />, {t("show the PFS")} — <HotkeyBadge id="boarding.pfs" />
          </li>
          <li>
            {t("Jump straight to a status tab, which also moves keyboard focus onto it")} — {t("All")} <HotkeyBadge id="boarding.filter-all" />, {t("Yet to board")} <HotkeyBadge id="boarding.filter-yet" />, {t("Boarded")} <HotkeyBadge id="boarding.filter-boarded" />
          </li>
          <li>
            {t("Once focus is on any tab in the status filter, the facet filter (Docs to verify, Services to pay, …) or the Sq №/Seat/Last Name search-mode tabs, move within that group")} — <Key combo="arrowleft" /> <Key combo="arrowright" />
          </li>
          <li>
            {t("The facet filter and search-mode tabs have no shortcut of their own — reach them by chaining from the search field")} — <Key combo="alt|arrowup" /> <Key combo="alt|arrowdown" />
          </li>
          <li>
            {t("From the search field, that same chain reaches the whole toolbar")} — <Key combo="alt|arrowup" /> {t("goes up through the search-mode tabs, PNL/PFS and the status filter tabs, all the way to Start boarding/Close flight and the scan button")}; <Key combo="alt|arrowdown" /> {t("goes down to the facet filter")}
          </li>
        </Step>

        <Step n={3} title={t("Passenger detail")}>
          <li>{t("Jump straight into the Sq № search field")} — <Key combo="/" /></li>
          <li>{t("Board this passenger")} — <HotkeyBadge id="boarding.board" /></li>
          <li className="help-note">
            {t("Same rule as the passenger list — Board is disabled (and its shortcut does nothing) until Start boarding has been pressed for this flight")}
          </li>
          <li>{t("Undo a boarding")} — <HotkeyBadge id="boarding.unboard" /></li>
          <li>{t("Open Pay, once a service payment is outstanding")} — <HotkeyBadge id="boarding.pay" /></li>
          <li>{t("Reprint the boarding pass")} — <HotkeyBadge id="boarding.reprint" /></li>
          <li>
            {t("The Documents/Seats/Baggage/Extra services shortcut icons follow the same one-Tab-stop-plus-arrow-keys pattern; Enter opens that step in a new tab")}
          </li>
          <li>
            {t("From the search field, reach the step icons")} — <Key combo="arrowdown" />, {t("then the Board/Unboard/Pay button")} — <Key combo="arrowdown" />, {t("then Reprint BP")} — <Key combo="arrowright" />
          </li>
          <li>{t("The seat map reaches one seat at a time and arrow keys move between seats, same scheme as the check-in flow's Seats step — but it's view-only here, so picking a seat doesn't reassign it")}</li>
        </Step>
      </Subsection>

      <Subsection title={t("Full reference")}>
        <p className="help-intro">{t("Every shortcut in the app, grouped, showing your own current bindings.")}</p>
        <div className="help-reference-grid">
          {GROUPED.map(({ group, items }) => (
            <div key={group} className="help-reference-group">
              <div className="shortcut-group-label">{t(group)}</div>
              {items.map((s) => (
                <Fragment key={s.id}>
                  <div className="help-reference-row">
                    <span className="shortcut-row-label">{t(s.label)}</span>
                    <HotkeyBadge id={s.id} />
                  </div>
                </Fragment>
              ))}
            </div>
          ))}
        </div>
      </Subsection>

      <Subsection title={t("Customizing shortcuts")}>
        <ul>
          <li>{t("Any Alt/Ctrl shortcut can be rebound from Settings → Keyboard shortcuts (account menu, top right).")}</li>
          <li>{t("This page always reflects your own current bindings, not just the defaults.")}</li>
        </ul>
      </Subsection>
      </Section>
    </div>
  );
}
