import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import RoleGuard from "./components/RoleGuard";
import { lazy, Suspense } from "react";

// Lazy load all pages for code splitting - dramatically reduces initial bundle
const Home = lazy(() => import("./pages/Home"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Hospitals = lazy(() => import("./pages/Hospitals"));
const Wallet = lazy(() => import("./pages/Wallet"));
const Issuer = lazy(() => import("./pages/Issuer"));
const Verifier = lazy(() => import("./pages/Verifier"));
const Consent = lazy(() => import("./pages/Consent"));
const Referral = lazy(() => import("./pages/Referral"));
const FhirMapping = lazy(() => import("./pages/FhirMapping"));
const Terminology = lazy(() => import("./pages/Terminology"));
const Audit = lazy(() => import("./pages/Audit"));
const Users = lazy(() => import("./pages/Users"));
const Settings = lazy(() => import("./pages/Settings"));
const ClaimCenter = lazy(() => import("./pages/ClaimCenter"));
const ClaimAnalytics = lazy(() => import("./pages/ClaimAnalytics"));
const International = lazy(() => import("./pages/International"));
const CrossBorder = lazy(() => import("./pages/CrossBorder"));
const Integration = lazy(() => import("./pages/Integration"));
const TrustRegistry = lazy(() => import("./pages/TrustRegistry"));
const SmartHealthLinks = lazy(() => import("./pages/SmartHealthLinks"));
const ShlViewer = lazy(() => import("./pages/ShlViewer"));
const ExecutiveDashboard = lazy(() => import("./pages/ExecutiveDashboard"));
const PatientIdentity = lazy(() => import("./pages/PatientIdentity"));
const PortabilityWorkbench = lazy(() => import("./pages/PortabilityWorkbench"));
const MakerQueue = lazy(() => import("./pages/MakerQueue"));
const CheckerQueue = lazy(() => import("./pages/CheckerQueue"));
const CredentialDetail = lazy(() => import("./pages/CredentialDetail"));
const AdapterSdk = lazy(() => import("./pages/AdapterSdk"));
const PartnerWizard = lazy(() => import("./pages/PartnerWizard"));
const PartnerPortal = lazy(() => import("./pages/PartnerPortal"));
const PatientProfile = lazy(() => import("./pages/PatientProfile"));
const PrepareForService = lazy(() => import("./pages/PrepareForService"));
const ServiceVerify = lazy(() => import("./pages/ServiceVerify"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
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
        <Route path="/claim-analytics" component={ClaimAnalytics} />
        <Route path="/integration" component={Integration} />
        <Route path="/adapter-sdk" component={AdapterSdk} />
        <Route path="/partner-wizard" component={PartnerWizard} />
        <Route path="/partner-portal" component={PartnerPortal} />
        <Route path="/fhir-mapping" component={FhirMapping} />
        <Route path="/terminology" component={Terminology} />
        <Route path="/trust-registry" component={TrustRegistry} />
        <Route path="/shl-viewer" component={ShlViewer} />
        <Route path="/shl" component={SmartHealthLinks} />
        <Route path="/executive" component={ExecutiveDashboard} />
        <Route path="/patient-identity" component={PatientIdentity} />
        <Route path="/profile" component={PatientProfile} />
        <Route path="/prepare-service" component={PrepareForService} />
        <Route path="/service-verify" component={ServiceVerify} />
        <Route path="/portability" component={PortabilityWorkbench} />
        <Route path="/audit" component={Audit} />
        <Route path="/users" component={Users} />
        <Route path="/settings" component={Settings} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
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
