import { useState, useEffect, useRef } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Bell, LogOut, CheckCircle2, FileSpreadsheet, FileText, X, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// --- Export Libraries ---
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

export default function Reports() {
  const navigate = useNavigate()
  const userRole = localStorage.getItem('role') || 'User'
  const isAdmin = userRole === 'Admin' || userRole === 'Super_Admin'

  const [appSettings, setAppSettings] = useState({ companyName: "IT NextGen", logoUrl: "" })
  const [notifications, setNotifications] = useState<any[]>([])
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // --- Property Filter State ---
  const [allowedProperties, setAllowedProperties] = useState<any[]>([])
  const [activeProperty, setActiveProperty] = useState(localStorage.getItem('activeProperty') || 'All')

  // Filter Data Lookups
  const [users, setUsers] = useState<any[]>([])
  const [properties, setProperties] = useState<any[]>([])

  // Selected Filter States
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [statusFilter, setStatusFilter] = useState("All")
  const [selectedUser, setSelectedUser] = useState("All")
  const [selectedProperty, setSelectedProperty] = useState(activeProperty) // Default to active context

  // Track previous unread count to trigger the audio playback
  const prevUnreadCount = useRef<number | null>(null)

  useEffect(() => {
    if (userRole !== 'Admin' && userRole !== 'Super_Admin') {
      navigate('/dashboard')
      return 
    }
    
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return 
    }

    const headers = { 'Authorization': `Bearer ${token}` }

    fetch('/api/settings', { headers }).then(res => res.json()).then(data => setAppSettings(data))
    
    // Fetch Allowed Properties for Context Switcher
    fetch('/api/my-properties', { headers })
      .then(res => res.json())
      .then(data => {
        setAllowedProperties(data.properties)
        // Force non-Super Admins out of 'All' view if they happen to have it stored
        if (data.role !== 'Super_Admin' && activeProperty === 'All') {
          const defaultProp = data.properties.length > 0 ? data.properties[0].id.toString() : ""
          setActiveProperty(defaultProp)
          setSelectedProperty(defaultProp) // Sync the report filter default
          localStorage.setItem('activeProperty', defaultProp)
        }
      })

    // Fetch dropdown data (Users are scoped to active property if selected)
    fetch(`/api/users?propertyFilter=${activeProperty}`, { headers }).then(res => res.json()).then(data => setUsers(data))
    fetch('/api/properties', { headers }).then(res => res.json()).then(data => setProperties(data))

    // Live Notification Fetcher
    const fetchNotifications = async () => {
      try {
        const response = await fetch('/api/notifications', { headers })
        if (response.ok) {
          const data = await response.json()
          const currentUnread = data.filter((n: any) => !n.isRead).length
          
          if (prevUnreadCount.current !== null && currentUnread > prevUnreadCount.current) {
            const audio = new Audio('/notification.mp3')
            audio.play().catch(err => console.log("Autoplay policy blocked audio:", err))
          }
          
          prevUnreadCount.current = currentUnread
          setNotifications(data)
        }
      } catch (error) { 
        console.error("Failed to fetch notifications") 
      }
    }

    fetchNotifications() // Initial load
    
    // Poll the server every 15 seconds for new notifications
    const intervalId = setInterval(fetchNotifications, 15000)
    
    // Cleanup interval when leaving the page
    return () => clearInterval(intervalId)
  }, [navigate, userRole, activeProperty]) // Re-run when context switches

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('activeProperty')
    window.location.href = '/login'
  }

  const handleContextSwitch = (val: string) => {
    setActiveProperty(val)
    localStorage.setItem('activeProperty', val)
    window.location.reload()
  }

  const markAsRead = async (id: number) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n))
    } catch (error) { console.error("Failed to mark read") }
  }

  const clearNotification = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation() 
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      setNotifications(notifications.filter((n: any) => n.id !== id))
    } catch (error) { console.error("Failed to clear notification") }
  }

  const clearAllNotifications = async () => {
    try {
      await fetch(`/api/notifications`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      setNotifications([])
    } catch (error) { console.error("Failed to clear notifications") }
  }

  const handleExport = async (format: 'excel' | 'pdf') => {
    setIsExporting(true)
    try {
      // Build Query String
      const params = new URLSearchParams()
      if (startDate) params.append("startDate", startDate)
      if (endDate) params.append("endDate", endDate)
      if (statusFilter !== "All") params.append("status", statusFilter)
      if (selectedUser !== "All") params.append("userId", selectedUser)
      if (selectedProperty !== "All") params.append("propertyId", selectedProperty)

      const response = await fetch(`/api/reports/tickets?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      
      if (!response.ok) throw new Error("Failed to fetch report data")
      
      const data = await response.json()
      if (data.length === 0) {
        alert("No tickets found for this date range and criteria.")
        setIsExporting(false)
        return
      }

      // Map JSON to Export-Friendly Format
      const exportData = data.map((req: any) => ({
        "Ticket ID": req.ticketNum,
        "Created Date": new Date(req.createdAt).toLocaleDateString(),
        "Title": req.title,
        "Category": req.category,
        "Priority": req.priority,
        "Status": req.status,
        "Creator Name": req.user?.firstName || req.user?.lastName ? `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() : "",
        "Creator Email": req.user?.email || "",
        "Assigned Hotel": req.user?.property?.name || "Global",
        "Hotel Code": req.user?.property?.code || "GLB"
      }))

      if (format === 'excel') {
        const worksheet = XLSX.utils.json_to_sheet(exportData)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Support Tickets")
        XLSX.writeFile(workbook, `Helpdesk_Report_${new Date().getTime()}.xlsx`)
      } 
      
      else if (format === 'pdf') {
        const doc = new jsPDF('landscape')
        doc.text(`${appSettings.companyName} - Helpdesk Export`, 14, 15)
        
        const tableColumn = Object.keys(exportData[0])
        const tableRows = exportData.map((obj: any) => Object.values(obj))

        autoTable(doc, {
          head: [tableColumn],
          body: tableRows,
          startY: 20,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [15, 23, 42] }, // Slate-900 Theme Match
        })

        doc.save(`Helpdesk_Report_${new Date().getTime()}.pdf`)
      }

    } catch (error) {
      alert("Failed to generate export. Please try again.")
    } finally {
      setIsExporting(false)
    }
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      {/* MOBILE-OPTIMIZED TOP RIBBON */}
      <header className="h-16 bg-slate-900 text-white flex items-center justify-between px-4 md:px-6 shrink-0 shadow-md relative z-30">
        <div className="flex items-center gap-3">
          {/* Hamburger Menu */}
          <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 text-slate-300 hover:text-white focus:outline-none">
            <Menu className="w-6 h-6" />
          </button>
          
          {appSettings.logoUrl && <img src={`${appSettings.logoUrl}`} alt="Logo" className="h-8 md:h-10 w-auto bg-white/10 rounded p-1 object-contain hidden sm:block" />}
          <h1 className="text-lg md:text-xl font-bold tracking-tight truncate max-w-[140px] md:max-w-none">{appSettings.companyName}</h1>
        </div>

        <div className="flex items-center gap-2 md:gap-6">
          
          {/* PROPERTY CONTEXT SWITCHER */}
          {(isAdmin || userRole === 'Super_Admin') && (
            <div className="hidden sm:block mr-2 md:mr-4">
              <Select value={activeProperty} onValueChange={handleContextSwitch}>
                <SelectTrigger className="w-[160px] md:w-[200px] h-9 bg-slate-800 border-slate-700 text-slate-200 focus:ring-indigo-500">
                  <SelectValue placeholder="Select Property Context" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {userRole === 'Super_Admin' && (
                    <SelectItem value="All" className="font-bold text-slate-800 border-b border-slate-100">
                      Globally (All Properties)
                    </SelectItem>
                  )}
                  {allowedProperties.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name} <span className="text-slate-400 text-xs ml-2">({p.code})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="relative">
            <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="relative p-2 hover:bg-slate-800 rounded-full transition-colors focus:outline-none">
              <Bell className="w-5 h-5 text-slate-300" />
              {unreadCount > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center border-2 border-slate-900">{unreadCount}</span>}
            </button>

            {isNotifOpen && (
              <div className="absolute right-[-40px] md:right-0 mt-3 w-[300px] md:w-80 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden text-slate-800 z-50">
                <div className="p-3 md:p-4 bg-slate-50 border-b border-slate-100 font-semibold flex justify-between items-center">
                  <span className="text-sm md:text-base">Notifications <span className="text-xs font-normal text-slate-500 ml-1">({unreadCount})</span></span>
                  {notifications.length > 0 && (
                    <button onClick={clearAllNotifications} className="text-[10px] text-red-600 hover:text-red-800 font-bold uppercase tracking-wider">
                      Clear All
                    </button>
                  )}
                </div>
                <div className="max-h-[60vh] md:max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-sm text-slate-500 text-center">You have no notifications.</div>
                  ) : (
                    notifications.map((n: any) => (
                      <div key={n.id} onClick={() => markAsRead(n.id)} className={`p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${!n.isRead ? 'bg-blue-50/30' : ''}`}>
                        <div className="flex justify-between items-start mb-1">
                          <h4 className={`text-sm pr-2 ${!n.isRead ? 'font-bold text-blue-900' : 'font-medium text-slate-700'}`}>{n.title}</h4>
                          <div className="flex items-center gap-2 shrink-0">
                            {!n.isRead ? <span className="h-2 w-2 bg-blue-600 rounded-full mt-0.5"></span> : <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                            <button onClick={(e) => clearNotification(e, n.id)} className="p-1 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded transition-colors"><X className="w-3 h-3" /></button>
                          </div>
                        </div>
                        {n.description && <p className={`text-xs ${!n.isRead ? 'text-slate-700' : 'text-slate-500'} mb-2`}>{n.description}</p>}
                        {n.dueDate && <div className="text-[10px] font-semibold text-amber-700 bg-amber-100 inline-block px-2 py-1 rounded">Due: {new Date(n.dueDate).toLocaleString()}</div>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <Button variant="outline" onClick={handleLogout} className="border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 h-9 hidden md:flex">
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>
      </header>

      {/* APP BODY */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* MOBILE OVERLAY BACKDROP */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
        )}

        {/* RESPONSIVE OFF-CANVAS SIDEBAR */}
        <aside className={`${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative z-50 w-64 h-[calc(100vh-4rem)] md:h-auto bg-slate-800 text-white p-6 flex flex-col transition-transform duration-300 ease-in-out`}>
          <div className="flex justify-between items-center md:hidden mb-6 pb-4 border-b border-slate-700">
            <span className="font-bold tracking-wider text-slate-300">MENU</span>
            <button className="text-slate-400 hover:text-white focus:outline-none" onClick={() => setIsMobileMenuOpen(false)}>
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* MOBILE CONTEXT SWITCHER */}
          {(isAdmin || userRole === 'Super_Admin') && (
            <div className="md:hidden mb-6">
              <Label className="text-xs text-slate-400 mb-2 block">Property Filter</Label>
              <Select value={activeProperty} onValueChange={handleContextSwitch}>
                <SelectTrigger className="w-full h-10 bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Select Property Context" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {userRole === 'Super_Admin' && <SelectItem value="All" className="font-bold text-slate-800">Globally (All Properties)</SelectItem>}
                  {allowedProperties.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <nav className="space-y-4 overflow-y-auto flex-1">
            <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/dashboard') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300'}`}>Dashboard</Link>
            <Link to="/tickets" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/tickets') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300'}`}>Tickets</Link>
            <Link to="/projects" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/projects') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300'}`}>Projects</Link>
            <Link to="/checklists" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/checklists') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300'}`}>Routine Checklists</Link>
            <Link to="/resources" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/resources') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300'}`}>Resource Hub</Link>
            <Link to="/hotels" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/hotels') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300'}`}>Hotel Details</Link>
            <Link to="/contacts" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/contacts') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300'}`}>Directory</Link>
            
            {(userRole === 'Admin' || userRole === 'Super_Admin') && (
              <>
                <Link to="/users" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/users') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300'}`}>User Management</Link>
                <Link to="/amc" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/amc') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300'}`}>AMC & Licenses</Link>
                <Link to="/reports" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/reports') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300'}`}>Reports & Exports</Link>
              </>
            )}
            
            {userRole === 'Super_Admin' && (
              <Link to="/settings" onClick={() => setIsMobileMenuOpen(false)} className={`block mt-6 pt-4 border-t border-slate-700 ${window.location.pathname.includes('/settings') ? 'text-amber-400 font-bold' : 'text-amber-500 font-medium hover:text-amber-400'}`}>Super Admin Console</Link>
            )}

            {/* Mobile Logout */}
            <button onClick={handleLogout} className="md:hidden flex items-center text-red-400 hover:text-red-300 mt-6 pt-4 border-t border-slate-700 w-full text-left font-medium">
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </button>
          </nav>
          
          <div className="mt-auto space-y-4 w-full shrink-0">
            <div className="text-sm text-slate-400 text-center pb-3 border-b border-slate-700 hidden md:block">
              Logged in as: <br/>
              <span className="text-white font-bold tracking-wide">{userRole}</span>
            </div>
          </div>
        </aside>

        {/* MOBILE-OPTIMIZED MAIN CONTENT */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden w-full">
          <header className="mb-6 md:mb-8">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Advanced Reporting Engine</h1>
            <p className="text-xs md:text-sm text-slate-500 mt-1">Extract operational data, metrics, and logs for external analysis.</p>
          </header>

          <Card className="max-w-3xl border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-100 p-4 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg w-fit"><FileSpreadsheet className="w-5 h-5" /></div>
                <div>
                  <CardTitle className="text-base md:text-lg text-slate-900">Ticket Volume & Operations Export</CardTitle>
                  <CardDescription className="text-xs md:text-sm mt-1">Filter and generate a comprehensive Excel or PDF report of support tickets.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-6 space-y-4 md:space-y-6">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 md:h-11" />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 md:h-11" />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                <div className="space-y-2">
                  <Label>Ticket Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="bg-white h-10 md:h-11"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="All">All Statuses</SelectItem>
                      <SelectItem value="Open">Open Only</SelectItem>
                      <SelectItem value="In Progress">In Progress Only</SelectItem>
                      <SelectItem value="Resolved">Resolved Only</SelectItem>
                      <SelectItem value="Closed">Closed Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Filter by Hotel/Property</Label>
                  <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                    <SelectTrigger className="bg-white h-10 md:h-11"><SelectValue placeholder="All Properties" /></SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="All">All Properties</SelectItem>
                      {properties.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Filter by Creator/User</Label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger className="bg-white h-10 md:h-11"><SelectValue placeholder="All Users" /></SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="All">All Users</SelectItem>
                      {users.map(u => (
                        <SelectItem key={u.id} value={u.id.toString()}>
                          {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-4 md:pt-6 mt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-3 md:gap-4">
                <Button 
                  onClick={() => handleExport('excel')} 
                  disabled={isExporting} 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 h-10 md:h-11 text-xs md:text-sm"
                >
                  <FileSpreadsheet className="w-4 h-4" /> 
                  {isExporting ? "Generating..." : "Download Excel (.xlsx)"}
                </Button>

                <Button 
                  onClick={() => handleExport('pdf')} 
                  disabled={isExporting} 
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2 h-10 md:h-11 text-xs md:text-sm"
                >
                  <FileText className="w-4 h-4" /> 
                  {isExporting ? "Generating..." : "Download PDF (.pdf)"}
                </Button>
              </div>

            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}