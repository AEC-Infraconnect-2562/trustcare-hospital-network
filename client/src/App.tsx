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
import ClaimCenter from "./pages/ClaimCenter";
import International from "./pages/International";
import CrossBorder from "./pages/CrossBorder";
import Integration from "./pages/Integration";
import TrustRegistry from "./pages/TrustRegistry";
import SmartHealthLinks from "./pages/SmartHealthLinks";
import ShlViewer from "./pages/ShlViewer";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import PatientIdentity from "./pages/PatientIdentity";
import PortabilityWorkbench from "./pages/PortabilityWorkbench";
import MakerQueue from "./pages/MakerQueue";
import CheckerQueue from "./pages/CheckerQueue";
import CredentialDetail from "./pages/CredentialDetail";
import RoleGuard from "./components/RoleGuard";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/hospitals" component={Hospitals} />
      <Route path="/wallet" component={Wallet} />
      <Route path="/issuer" component={Issuer} />
      <Route path="/issuer/:id" component={CredentialDetail} />
      <Route path="/maker-queue" component={MakerQueue} />
      <Route path="/checker-queue" component={CheckerQueue} />
      <Route path="/verifier" component={Verifier} />
      <Route path="/consent" component={Consent} />
      <Route path="/referral" component={Referral} />
      <Route path="/cross-border" component={CrossBorder} />
      <Route path="/international" component={International} />
      <Route path="/claim-center" component={ClaimCenter} />
      <Route path="/integration" component={Integration} />
      <Route path="/fhir-mapping" component={FhirMapping} />
      <Route path="/terminology" component={Terminology} />
      <Route path="/trust-registry" component={TrustRegistry} />
      <Route path="/shl-viewer" component={ShlViewer} />
      <Route path="/shl" component={SmartHealthLinks} />
      <Route path="/executive" component={ExecutiveDashboard} />
      <Route path="/patient-identity" component={PatientIdentity} />
      <Route path="/portability" component={PortabilityWorkbench} />
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
          <RoleGuard>
            <Router />
          </RoleGuard>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
