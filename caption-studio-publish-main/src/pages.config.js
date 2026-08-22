/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import __Layout from './Layout.jsx'
import { lazyWithRefresh } from './lib/lazyWithRefresh'

const Dashboard = lazyWithRefresh(() => import('./pages/Dashboard'), 'Dashboard')
const Home = lazyWithRefresh(() => import('./pages/Home'), 'Home')
const HomeV2 = lazyWithRefresh(() => import('./pages/HomeV2'), 'HomeV2')
const Login = lazyWithRefresh(() => import('./pages/Login'), 'Login')
const UserAccount = lazyWithRefresh(() => import('./pages/UserAccount'), 'UserAccount')
const Faq = lazyWithRefresh(() => import('./pages/Faq'), 'Faq')
const TermsAndConditions = lazyWithRefresh(() => import('./pages/TermsAndConditions'), 'TermsAndConditions')
const PrivacyPolicy = lazyWithRefresh(() => import('./pages/PrivacyPolicy'), 'PrivacyPolicy')
const RefundPolicy = lazyWithRefresh(() => import('./pages/RefundPolicy'), 'RefundPolicy')
const AcceptableUsePolicy = lazyWithRefresh(() => import('./pages/AcceptableUsePolicy'), 'AcceptableUsePolicy')
const HelpAndSupport = lazyWithRefresh(() => import('./pages/HelpAndSupport'), 'HelpAndSupport')
const AdminOps = lazyWithRefresh(() => import('./pages/AdminOps'), 'AdminOps')
const KnownLimitations = lazyWithRefresh(() => import('./pages/KnownLimitations'), 'KnownLimitations')
const Changelog = lazyWithRefresh(() => import('./pages/Changelog'), 'Changelog')

export const PAGES = {
    "Dashboard": Dashboard,
    "Home": Home,
    "HomeV2": HomeV2,
    "login": Login,
    "UserAccount": UserAccount,
    "Faq": Faq,
    "TermsAndConditions": TermsAndConditions,
    "PrivacyPolicy": PrivacyPolicy,
    "RefundPolicy": RefundPolicy,
    "AcceptableUsePolicy": AcceptableUsePolicy,
    "HelpAndSupport": HelpAndSupport,
    "AdminOps": AdminOps,
    "KnownLimitations": KnownLimitations,
    "Changelog": Changelog,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
}
