import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  BookOpenText, Headphones, House, NotePencil, UserCircle, Gear, Exam,
} from "@phosphor-icons/react";
import { AppFrame, TimerTools } from "./components/LearningUI";
import Ballpit from "./components/Ballpit/Ballpit";
import PdfViewer from "./components/PdfViewer";
import Home from "./pages/Home";
import Listening from "./pages/Listening";
import Reading from "./pages/Reading";
import Writing from "./pages/Writing";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import MockExam from "./pages/MockExam";
import Review from "./pages/Review";
import { scrollPageToTop } from "./lib/pageScroll";

const navigation = [
  { id: "home", label: "首页", icon: House },
  { id: "listening", label: "听力", icon: Headphones },
  { id: "reading", label: "阅读", icon: BookOpenText },
  { id: "writing", label: "写作", icon: NotePencil },
  { id: "mock", label: "模考", icon: Exam },
  { id: "profile", label: "我", icon: UserCircle },
  { id: "settings", label: "设置", icon: Gear },
];

function StartupSplash({ onComplete }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fadeDelay = reducedMotion ? 700 : 2600;
    const removeDelay = reducedMotion ? 760 : 3200;
    const fadeTimer = window.setTimeout(() => setExiting(true), fadeDelay);
    const removeTimer = window.setTimeout(onComplete, removeDelay);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`startup-splash ${exiting ? "is-exiting" : ""}`}
      role="status"
      aria-label="IELTSyn 正在启动"
    >
      <span className="ui-startup-wordmark">IELTSyn.</span>
    </div>
  );
}

function App() {
  const desktopPdf = new URLSearchParams(window.location.search).get("desktopPdf");
  const [page, setPage] = useState("home");
  const [pageIntent, setPageIntent] = useState(null);
  const [navigationKey, setNavigationKey] = useState(0);
  const [showStartupSplash, setShowStartupSplash] = useState(true);
  const [timerBallpit, setTimerBallpit] = useState("hidden");

  const navigate = (nextPage, intent = null) => {
    setPage(nextPage);
    setPageIntent(intent);
    setNavigationKey((value) => value + 1);
  };

  useLayoutEffect(() => {
    scrollPageToTop();
    const frame = window.requestAnimationFrame(scrollPageToTop);
    return () => window.cancelAnimationFrame(frame);
  }, [navigationKey]);

  useEffect(() => {
    let dismissTimer = 0;
    const showBallpit = () => {
      window.clearTimeout(dismissTimer);
      setTimerBallpit("visible");
    };
    const dismissBallpit = () => {
      setTimerBallpit((phase) => {
        if (phase === "hidden" || phase === "exiting") return phase;
        return "exiting";
      });
      window.clearTimeout(dismissTimer);
      dismissTimer = window.setTimeout(() => setTimerBallpit("hidden"), 1000);
    };
    const complete = () => showBallpit();
    window.addEventListener("timer-countdown-complete", complete);
    window.addEventListener("pointerdown", dismissBallpit, true);
    return () => {
      window.clearTimeout(dismissTimer);
      window.removeEventListener("timer-countdown-complete", complete);
      window.removeEventListener("pointerdown", dismissBallpit, true);
    };
  }, []);

  const content = useMemo(() => {
    const props = { navigate, intent: pageIntent };
    switch (page) {
      case "listening": return <Listening {...props} />;
      case "reading": return <Reading {...props} />;
      case "writing": return <Writing {...props} />;
      case "mock": return null;
      case "profile": return <Profile {...props} />;
      case "settings": return <Settings {...props} />;
      case "review": return <Review {...props} />;
      default: return <Home {...props} />;
    }
  }, [page, pageIntent, navigationKey]);

  if (desktopPdf) {
    return <div className="desktop-pdf-window"><PdfViewer src={desktopPdf} title="IELTSyn PDF" /></div>;
  }

  return (
    <>
      <AppFrame active={page} navigate={navigate} navigation={navigation} tools={<TimerTools/>}>
        <main className="ui-main-shell">
          <div className="page-container" key={navigationKey}>{content}</div>
          <div className="page-container" hidden={page !== "mock"}><MockExam /></div>
        </main>
      </AppFrame>
      {showStartupSplash && <StartupSplash onComplete={() => setShowStartupSplash(false)} />}
      {timerBallpit !== "hidden" && (
        <div
          className={`timer-finish-ballpit ${timerBallpit === "exiting" ? "is-exiting" : ""}`}
          role="status"
          aria-label="倒计时结束"
        >
          <Ballpit
            count={72}
            colors={[0x0000ee, 0x58cc02, 0x1cb0f6, 0xffffff]}
            gravity={0.42}
            friction={0.9975}
            wallBounce={0.92}
            maxVelocity={0.12}
            minSize={0.34}
            maxSize={0.82}
            size0={0.7}
            followCursor={false}
          />
        </div>
      )}
    </>
  );
}

export default App;
