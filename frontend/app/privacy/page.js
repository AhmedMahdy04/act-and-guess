import CookieConsent from '../../components/CookieConsent';

export default function Privacy() {
  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="mb-6 text-3xl font-black text-slate-100">Privacy</h1>

      <div className="space-y-6 leading-relaxed text-slate-300">
        <section>
          <h2 className="mb-2 text-lg font-bold text-slate-100">Game information</h2>
          <p>
            A room records the players’ chosen display names, team assignments, settings, guesses, and scores. Players in the room can see the roster and gameplay activity. Public rooms also list the host’s display name and room code on the home page.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold text-slate-100">Room history and reconnecting</h2>
          <p>
            The game keeps a session credential in your browser tab so you can reconnect. When MongoDB is enabled, it saves room state and match records so they survive server restarts. Closed rooms are archived.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-100">Advertising preferences</h2>
          <p>
            On deployments that offer advertising, third-party ads only load if you allow them. Ad partners may use cookies or similar storage. The browser remembers your choice.
          </p>
          <CookieConsent manage />
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold text-slate-100">Contact</h2>
          <p>Contact the site administrator for questions about game records or privacy.</p>
        </section>
      </div>
    </main>
  );
}
