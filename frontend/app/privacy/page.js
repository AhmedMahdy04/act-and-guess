export default function Privacy() {
  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-100 mb-6">Privacy Policy</h1>

      <div className="space-y-6 text-slate-400 leading-relaxed">
        <section>
          <h2 className="text-lg font-bold text-slate-200 mb-2">1. Introduction</h2>
          <p>
            This Privacy Policy explains how we collect, use, and protect your information when you use Act & Guess.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-200 mb-2">2. Information We Collect</h2>
          <p>When you create or join a game, we temporarily store:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Your chosen player name</li>
            <li>Game room codes and scores</li>
            <li>Team assignments</li>
          </ul>
          <p className="mt-2">
            This data is stored in memory during gameplay and is not tied to any real-world identity.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-200 mb-2">3. Advertising</h2>
          <p>
            We use third-party advertising partners (such as Adsterra) to display ads. These partners may use cookies or similar technologies to serve personalized ads based on your browsing activity.
          </p>
          <p className="mt-2">
            You can opt out of personalized advertising through your browser settings or by visiting
            <a href="https://www.youronlinechoices.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline"> Your Online Choices</a>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-200 mb-2">4. Data Retention</h2>
          <p>
            Game data is temporary and is removed when a game session ends or when the server restarts. We do not retain personal information permanently.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-200 mb-2">5. Contact</h2>
          <p>
            If you have questions about this Privacy Policy, please contact the site administrator.
          </p>
        </section>
      </div>
    </main>
  );
}

