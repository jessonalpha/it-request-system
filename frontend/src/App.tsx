import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"

// --- Page Imports ---
import Login from "./pages/Login" 
import Dashboard from "./pages/Dashboard"
import Tickets from "./pages/Tickets" 
import TicketDetail from "./pages/TicketDetail" 
import Directory from "./pages/Directory" 
import Users from "./pages/Users"
import AMC from "./pages/AMC"
import Settings from "./pages/Settings"
import HotelDetails from "./pages/HotelDetails" 
import Reports from "./pages/Reports"
import AMCDetail from "./pages/AMCDetail"
import Projects from "./pages/Projects"
import ProjectDetail from "./pages/ProjectDetail"
import Checklists from "./pages/Checklists"
import ResourceHub from "./pages/ResourceHub"

export default function App() {
  // Strict check to completely prevent the flashing redirect loop
  const rawToken = localStorage.getItem('token');
  const isAuthenticated = Boolean(rawToken && rawToken !== "undefined" && rawToken !== "null");

  return (
    <BrowserRouter>
      <Routes>
        {/* Authentication */}
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} 
        />
        
        {/* Core Modules */}
        <Route 
          path="/dashboard" 
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/tickets" 
          element={isAuthenticated ? <Tickets /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/tickets/:id" 
          element={isAuthenticated ? <TicketDetail /> : <Navigate to="/login" replace />} 
        />
        
        {/* Projects Module */}
        <Route 
          path="/projects" 
          element={isAuthenticated ? <Projects /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/projects/:id" 
          element={isAuthenticated ? <ProjectDetail /> : <Navigate to="/login" replace />} 
        />

        {/* Checklists Module */}
        <Route 
          path="/checklists" 
          element={isAuthenticated ? <Checklists /> : <Navigate to="/login" replace />} 
        />
        
        {/* Property & Directory */}
        <Route 
          path="/hotels" 
          element={isAuthenticated ? <HotelDetails /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/contacts" 
          element={isAuthenticated ? <Directory /> : <Navigate to="/login" replace />} 
        />
        
        {/* Admin & Management */}
        <Route 
          path="/users" 
          element={isAuthenticated ? <Users /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/amc" 
          element={isAuthenticated ? <AMC /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/amc/:id" 
          element={isAuthenticated ? <AMCDetail /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/settings" 
          element={isAuthenticated ? <Settings /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/reports" 
          element={isAuthenticated ? <Reports /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/resources" 
          element={isAuthenticated ? <ResourceHub /> : <Navigate to="/login" replace />} 
        />
        {/* Fallback Catch-All */}
        <Route 
          path="*" 
          element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} 
        />
      </Routes>
    </BrowserRouter>
  )
}