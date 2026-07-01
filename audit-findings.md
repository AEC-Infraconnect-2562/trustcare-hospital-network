# Menu Visibility & Role Audit Findings

## Current Roles (systemRole enum)
- system_admin
- hospital_admin
- doctor
- nurse
- integration_engineer
- patient

## Issues Found

### 1. Missing DashboardLayout on some pages
Pages that DON'T wrap with DashboardLayout (but are in the sidebar menu):
- ExecutiveDashboard.tsx - In menu for system_admin, hospital_admin
- PatientIdentity.tsx - In menu for system_admin, hospital_admin, integration_engineer

These pages will render WITHOUT the sidebar when navigated to directly.

### 2. Missing Icons in iconMap
The following icons are used in allMenuItems but NOT in the iconMap:
- "BarChart3" (used by executive dashboard)
- "Fingerprint" (used by patient-identity)

This means these menu items will fall back to LayoutDashboard icon.

### 3. Menu Visibility Matrix (Current State)

| Menu Item | system_admin | hospital_admin | doctor | nurse | integration_engineer | patient |
|-----------|:---:|:---:|:---:|:---:|:---:|:---:|
| dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| executive | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| wallet | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| consent | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| shl | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| referral | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| cross-border | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| international | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| issuer | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| verifier | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| trust-registry | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| claim-center | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| integration | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| portability | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| fhir-mapping | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| terminology | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| patient-identity | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| hospitals | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| audit | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| users | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| settings | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### 4. Recommended Fixes

#### A. Add missing icons to iconMap
Add BarChart3 and Fingerprint to both the import and iconMap.

#### B. Wrap ExecutiveDashboard and PatientIdentity with DashboardLayout
These pages need to be wrapped so the sidebar shows when navigating to them.

#### C. Role-based access control on routes
Currently all routes are accessible to anyone who is logged in. We should add
role-based guards on the backend (protectedProcedure checks systemRole) and
optionally redirect on the frontend if a user navigates to a page they shouldn't see.

#### D. Demo Login System
Add demo login so we can test each role without Manus OAuth.
