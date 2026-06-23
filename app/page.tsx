import FeedbackForm from "@/components/FeedbackForm";

export default function Home() {
  return (
    <div className="wrap">
      <header className="hero">
        <h1>Tell us what you think of the new app! 🚀</h1>
        <p>
          Your answers help us make the app better. There are no wrong answers — please be honest.
          We ask for your admission number so we can follow up on any problems you report.
        </p>
        <p style={{ marginTop: 8 }}>
          💬 You can answer by tapping a choice <strong>or</strong> by tapping{" "}
          <strong>🎤 Record answer</strong> to say it out loud.
        </p>
      </header>

      <FeedbackForm />

      <footer>
        Your answers are linked to your admission number and seen only by the app team. · New App
        Beta
      </footer>
    </div>
  );
}
