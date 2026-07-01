import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Hospitals from "./pages/Hospitals";
import Wallet from "./pages/Wallet";
import Issuer from "./pages/Issuer";
import Verifier from "./pages/Verifier";
import Consent from "./pages/Consent";
import Referral from "./pages/Referral";
import FhirMapping from "./pages/FhirMapping";
import Terminology from "./pages/Terminology";
import Audit from "./pages/Audit";
import Users from "./pages/Users";
import Settings from "./pages/Settings";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/hospitals" component={Hospitals} />
      <Route path="/wallet" component={Wallet} />
      <Route path="/issuer" component={Issuer} />
      <Route path="/verifier" component={Verifier} />
      <Route path="/consent" component={Consent} />
      <Route path="/referral" component={Referral} />
      <Route path="/fhir-mapping" component={FhirMapping} />
      <Route path="/terminology" component={Terminology} />
      <Route path="/audit" component={Audit} />
      <Route path="/users" component={Users} />
      <Route path="/settings" component={Settings} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
