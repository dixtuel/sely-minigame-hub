import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import CookieConsentBanner from "./components/CookieConsentBanner";
import { CookieConsentProvider } from "./contexts/CookieConsentContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Legal from "./pages/Legal";
import { browserLocale } from "./lib/i18n";
import { useLocation } from "wouter";

function DefaultHome() {
  const [, navigate] = useLocation();
  useEffect(() => { if (browserLocale() === "en") navigate("/en", { replace: true }); }, [navigate]);
  return <Home locale="tr" />;
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={DefaultHome} />
      <Route path={"/en"}>{() => <Home locale="en" />}</Route>
      <Route path={"/play/:game"}>{(params) => <Home locale="tr" directGameId={params.game} />}</Route>
      <Route path={"/en/play/:game"}>{(params) => <Home locale="en" directGameId={params.game} />}</Route>
      <Route path={"/privacy"}>{() => <Legal kind="privacy" />}</Route>
      <Route path={"/terms"}>{() => <Legal kind="terms" />}</Route>
      <Route path={"/accessibility"}>{() => <Legal kind="accessibility" />}</Route>
      <Route path={"/en/privacy"}>{() => <Legal kind="privacy" locale="en" />}</Route>
      <Route path={"/en/terms"}>{() => <Legal kind="terms" locale="en" />}</Route>
      <Route path={"/en/accessibility"}>{() => <Legal kind="accessibility" locale="en" />}</Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <CookieConsentProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
            <CookieConsentBanner />
          </TooltipProvider>
        </CookieConsentProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
