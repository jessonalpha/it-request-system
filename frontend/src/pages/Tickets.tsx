import { useState, useEffect, useRef } from "react"
import { useNavigate, useLocation, Link } from "react-router-dom"
import { Search, Bell, LogOut, CheckCircle2, X, Menu, Ticket, CircleDashed, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function Tickets() {
  const navigate = useNavigate()
  const location = useLocation()
  
  const [requests, setRequests] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([]) 
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>((location.state as any)?.filter || "All")
  const [searchQuery, setSearchQuery] = useState("")
  
  const userRole = localStorage.getItem('role') || 'User'
  const isAdmin = userRole === 'Admin' || userRole === 'Super_Admin'

  const [appSettings, setAppSettings] = useState({ companyName: "IT NextGen", logoUrl: "" })
  const [notifications, setNotifications] = useState<any[]>([])
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // --- Explicit User Permissions ---
  const [myPermissions, setMyPermissions] = useState<Record<string, any>>({})

  // --- Property Filter State ---
  const [allowedProperties, setAllowedProperties] = useState<any[]>([])
  const [activeProperty, setActiveProperty] = useState(localStorage.getItem('activeProperty') || 'All')

  // --- New Ticket State ---
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("") 
  const [category, setCategory] = useState("")
  const [priority, setPriority] = useState("")
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>([]) 

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('activeProperty')
    window.location.href = '/login'
  }

  const prevUnreadCount = useRef<number | null>(null)
  
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token || token === "undefined") {
      navigate('/login')
      return
    }

    const headers = { 'Authorization': `Bearer ${token}` }

    // Fetch My Permissions Securely
    fetch('/api/users/me/permissions', { headers })
      .then(res => res.ok ? res.json() : { permissions: {} })
      .then(data => setMyPermissions(data.permissions || {}))
      .catch(() => setMyPermissions({}))

    fetch('/api/settings', { headers }).then(res => res.json()).then(data => setAppSettings(data)).catch(() => {})
    fetch(`/api/users?propertyFilter=${activeProperty}`, { headers }).then(res => res.ok && res.json()).then(data => data && setUsers(data)).catch(() => {})

    // Fetch Allowed Properties for Context Switcher
    fetch('/api/my-properties', { headers })
      .then(res => res.ok ? res.json() : { properties: [], role: 'User' })
      .then(data => {
        setAllowedProperties(data.properties || [])
        // Force non-Super Admins out of 'All' view if they happen to have it stored
        if (data.role !== 'Super_Admin' && activeProperty === 'All') {
          const defaultProp = data.properties && data.properties.length > 0 ? data.properties[0].id.toString() : ""
          setActiveProperty(defaultProp)
          localStorage.setItem('activeProperty', defaultProp)
        }
      }).catch(() => {})

    const fetchRequests = async () => {
      try {
        const response = await fetch(`/api/requests?propertyFilter=${activeProperty}`, { headers })
        if (response.status === 401 || response.status === 403) return handleLogout()
        if (response.ok) {
          const data = await response.json()
          setRequests(data)
        }
      } catch (error) {
        console.error("Failed to fetch requests", error)
      } finally {
        setLoading(false) 
      }
    }

    const fetchNotifications = async () => {
      try {
        const response = await fetch('/api/notifications', { headers })
        if (response.ok) {
          const data = await response.json()
          const currentUnread = data.filter((n: any) => !n.isRead).length
          
          if (prevUnreadCount.current !== null && currentUnread > prevUnreadCount.current) {
            new Audio('/notification.mp3').play().catch(() => {})
          }
          
          prevUnreadCount.current = currentUnread
          setNotifications(data)
        }
      } catch (error) {}
    }

    fetchRequests()
    fetchNotifications() 
    
    const intervalId = setInterval(fetchNotifications, 15000)
    return () => clearInterval(intervalId)
  }, [navigate, activeProperty]) 

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

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !description || !category || !priority) return alert("Please fill out all required fields!")

    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ title, description, category, priority, taggedUserIds }), 
      })

      if (response.ok) {
        const newTicket = await response.json()
        setRequests([newTicket, ...requests]) 
        setIsDialogOpen(false)
        setTitle(""); setDescription(""); setCategory(""); setPriority(""); setTaggedUserIds([]) 
        setActiveTab("All")
      }
    } catch (error) { alert("Network Error") }
  }

  const handleStatusChange = async (ticketId: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/requests/${ticketId}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: newStatus }),
      })
      if (response.ok) {
        setRequests(requests.map(req => req.id === ticketId ? { ...req, status: newStatus } : req))
      }
    } catch (error) { console.error("Failed to update status") }
  }

  // Modern Metrics Grid Arrays
  const totalReqs = requests.length
  const openReqs = requests.filter(r => r.status === "Open").length
  const progressReqs = requests.filter(r => r.status === "In Progress").length
  const resolvedReqs = requests.filter(r => r.status === "Resolved").length

  const metrics = [
    { title: "All Requests", value: totalReqs, icon: Ticket, color: "text-slate-600", bg: "bg-slate-100", filter: "All" },
    { title: "Open", value: openReqs, icon: CircleDashed, color: "text-amber-600", bg: "bg-amber-50", filter: "Open" },
    { title: "In Progress", value: progressReqs, icon: Timer, color: "text-indigo-600", bg: "bg-indigo-50", filter: "In Progress" },
    { title: "Resolved", value: resolvedReqs, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", filter: "Resolved" },
  ]

  const displayedRequests = requests.filter(r => {
    const matchesTab = activeTab === "All" || r.status === activeTab;
    const matchesSearch = (r.title && r.title.toLowerCase().includes(searchQuery.toLowerCase())) || 
                          (r.ticketNum && r.ticketNum.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length
  const canCreateTickets = isAdmin || !!myPermissions.create_tickets;

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC]">
      
      {/* MOBILE-OPTIMIZED TOP RIBBON */}
      <header className="h-16 bg-slate-900 text-white flex items-center justify-between px-4 md:px-6 shrink-0 shadow-md relative z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 text-slate-300 hover:text-white focus:outline-none">
            <Menu className="w-6 h-6" />
          </button>
          
          {appSettings.logoUrl && (
            <img src={`${appSettings.logoUrl}`} alt="Logo" className="h-8 md:h-10 w-auto rounded p-1 object-contain hidden sm:block" />
          )}
          <h1 className="text-lg md:text-xl font-bold tracking-tight truncate max-w-[140px] md:max-w-none">{appSettings.companyName}</h1>
        </div>

        <div className="flex items-center gap-2 md:gap-6">
          
          {/* PROPERTY CONTEXT SWITCHER */}
          {(isAdmin || userRole === 'Super_Admin') && (
            <div className="hidden sm:block mr-2 md:mr-4">
              <Select value={activeProperty} onValueChange={handleContextSwitch}>
                <SelectTrigger className="w-[160px] md:w-[200px] h-9 bg-slate-800 border-slate-700 text-slate-200 focus:ring-indigo-500 rounded-lg">
                  <SelectValue placeholder="Select Property Context" />
                </SelectTrigger>
                <SelectContent className="bg-white rounded-xl shadow-xl border-slate-100">
                  {userRole === 'Super_Admin' && (
                    <SelectItem value="All" className="font-bold text-slate-800 border-b border-slate-50 mb-1">
                      Globally (All Properties)
                    </SelectItem>
                  )}
                  {allowedProperties.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()} className="font-medium">
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
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center border-2 border-slate-900">
                  {unreadCount}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-[-40px] md:right-0 mt-3 w-[300px] md:w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-slate-800 z-50">
                <div className="p-3 md:p-4 bg-slate-50/80 backdrop-blur-md border-b border-slate-100 font-semibold flex justify-between items-center">
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
                    notifications.map(n => (
                      <div key={n.id} onClick={() => markAsRead(n.id)} className={`p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${!n.isRead ? 'bg-blue-50/30' : ''}`}>
                        <div className="flex justify-between items-start mb-1">
                          <h4 className={`text-sm pr-2 ${!n.isRead ? 'font-bold text-blue-900' : 'font-medium text-slate-700'}`}>{n.title}</h4>
                          <div className="flex items-center gap-2 shrink-0">
                            {!n.isRead ? <span className="h-2 w-2 bg-blue-600 rounded-full mt-0.5"></span> : <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                            <button onClick={(e) => clearNotification(e, n.id)} className="p-1 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded transition-colors"><X className="w-3 h-3" /></button>
                          </div>
                        </div>
                        {n.description && <p className={`text-xs ${!n.isRead ? 'text-slate-700' : 'text-slate-500'} mb-2`}>{n.description}</p>}
                        {n.dueDate && <div className="text-[10px] font-semibold text-amber-700 bg-amber-100 inline-block px-2 py-1 rounded-md mt-2">Due: {new Date(n.dueDate).toLocaleString()}</div>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <Button variant="outline" onClick={handleLogout} className="border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 h-9 hidden md:flex rounded-lg">
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        
        {/* MOBILE OVERLAY BACKDROP */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
        )}

        {/* RESPONSIVE OFF-CANVAS SIDEBAR */}
        <aside className={`${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative z-50 w-64 h-[calc(100vh-4rem)] md:h-auto bg-slate-900 border-r border-slate-800 text-white p-6 flex flex-col transition-transform duration-300 ease-in-out`}>
          <div className="flex justify-between items-center md:hidden mb-6 pb-4 border-b border-slate-800">
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
                <SelectTrigger className="w-full h-10 bg-slate-800 border-slate-700 text-white rounded-lg">
                  <SelectValue placeholder="Select Property Context" />
                </SelectTrigger>
                <SelectContent className="bg-white rounded-xl shadow-xl border-slate-100">
                  {userRole === 'Super_Admin' && <SelectItem value="All" className="font-bold text-slate-800">Globally (All Properties)</SelectItem>}
                  {allowedProperties.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <nav className="space-y-4 overflow-y-auto flex-1">
            <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/dashboard') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300 transition-colors'}`}>Dashboard</Link>
            <Link to="/tickets" onClick={() => setIsMobileMenuOpen(false)} className={`block text-white font-medium`}>Tickets</Link>
            <Link to="/projects" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/projects') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300 transition-colors'}`}>Projects</Link>
            <Link to="/checklists" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/checklists') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300 transition-colors'}`}>Routine Checklists</Link>
            <Link to="/resources" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/resources') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300 transition-colors'}`}>Resource Hub</Link>
            <Link to="/hotels" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/hotels') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300 transition-colors'}`}>Hotel Details</Link>
            <Link to="/contacts" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/contacts') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300 transition-colors'}`}>Directory</Link>
            
            {(userRole === 'Admin' || userRole === 'Super_Admin') && (
              <>
                <Link to="/users" onClick={() => setIsMobileMenuOpen(false)} className={`block text-slate-400 hover:text-slate-300 transition-colors`}>User Management</Link>
                <Link to="/amc" onClick={() => setIsMobileMenuOpen(false)} className={`block text-slate-400 hover:text-slate-300 transition-colors`}>AMC & Licenses</Link>
                <Link to="/reports" onClick={() => setIsMobileMenuOpen(false)} className={`block text-slate-400 hover:text-slate-300 transition-colors`}>Reports & Exports</Link>
              </>
            )}
            
            {userRole === 'Super_Admin' && (
              <Link to="/settings" onClick={() => setIsMobileMenuOpen(false)} className={`block mt-6 pt-4 border-t border-slate-800 text-indigo-400/80 font-medium hover:text-indigo-300 transition-colors`}>Super Admin Console</Link>
            )}

            <button onClick={handleLogout} className="md:hidden flex items-center text-red-400 hover:text-red-300 mt-6 pt-4 border-t border-slate-800 w-full text-left font-medium transition-colors">
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </button>
          </nav>

          {canCreateTickets && (
            <Button onClick={() => { setIsMobileMenuOpen(false); setIsDialogOpen(true); }} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold mt-6 shrink-0 rounded-xl shadow-lg shadow-indigo-900/20">
              Create Ticket
            </Button>
          )}
        </aside>

        {/* MODERN MAIN CONTENT */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden w-full">
          <div className="max-w-6xl mx-auto">
            <header className="mb-8 flex justify-between items-end">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Support Tickets</h1>
                <p className="text-sm text-slate-500 mt-1">Search, organize, and manage active IT requests.</p>
              </div>
              
              {/* Mobile "New Ticket" action button */}
              {canCreateTickets && (
                <Button onClick={() => setIsDialogOpen(true)} className="md:hidden bg-indigo-600 text-white h-10 px-4 rounded-xl shadow-md">
                  New Ticket
                </Button>
              )}
            </header>

            {/* 4-COLUMN NEW GEN METRICS GRID */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
              {metrics.map((metric, idx) => (
                <Card 
                  key={idx} 
                  onClick={() => setActiveTab(metric.filter)}
                  className={`cursor-pointer border-none transition-all rounded-2xl group relative overflow-hidden ${activeTab === metric.filter ? 'ring-2 ring-indigo-600 bg-white shadow-md' : 'shadow-sm hover:shadow-md bg-white opacity-80 hover:opacity-100'}`} 
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardContent className="p-5 md:p-6 relative z-10">
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-3 rounded-xl ${metric.bg} ${metric.color}`}>
                        <metric.icon className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">{metric.value}</h3>
                      <p className="text-xs md:text-sm font-medium text-slate-500 mt-1">{metric.title}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* MODERN DATA TABLE */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden mb-8">
              <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search tickets by ID or title..." 
                    className="pl-10 h-10 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 w-full"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="overflow-x-auto w-full">
                <Table className="min-w-[700px] w-full">
                  <TableHeader>
                    <TableRow className="border-b border-slate-100 bg-slate-50/50 hover:bg-slate-50/50">
                      <TableHead className="font-semibold text-slate-500 h-11 px-5 text-[11px] uppercase tracking-wider w-[120px]">Ticket ID</TableHead>
                      <TableHead className="font-semibold text-slate-500 h-11 px-5 text-[11px] uppercase tracking-wider">Details</TableHead>
                      <TableHead className="font-semibold text-slate-500 h-11 px-5 text-[11px] uppercase tracking-wider">Category</TableHead>
                      <TableHead className="font-semibold text-slate-500 h-11 px-5 text-[11px] uppercase tracking-wider">Priority</TableHead>
                      <TableHead className="font-semibold text-slate-500 h-11 px-5 text-[11px] uppercase tracking-wider">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={5} className="text-center py-12 text-slate-400 text-sm border-none">
                          Loading tickets...
                        </TableCell>
                      </TableRow>
                    ) : displayedRequests.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={5} className="text-center py-12 text-slate-400 text-sm border-none">
                          No tickets found matching your criteria.
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayedRequests.map((req) => (
                        <TableRow key={req.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors group">
                          <TableCell className="px-5 py-3 font-semibold text-slate-700 text-xs">
                            <Link to={`/tickets/${req.id}`} className="group-hover:text-indigo-600 transition-colors">{req.ticketNum}</Link>
                          </TableCell>
                          <TableCell className="px-5 py-3">
                            <div className="font-medium text-slate-900 text-sm mb-0.5 truncate max-w-[250px]">{req.title}</div>
                            <div className="text-xs text-slate-500 truncate max-w-[250px]">{req.description}</div>
                            
                            {req.taggedUsers && req.taggedUsers.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {req.taggedUsers.map((tu: any) => (
                                  <span key={tu.id} className="bg-indigo-50 text-indigo-600 border border-indigo-100 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    @{tu.firstName || tu.email.split('@')[0]}
                                  </span>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="px-5 py-3 text-slate-600 text-sm font-medium">{req.category}</TableCell>
                          <TableCell className="px-5 py-3">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide ${req.priority === 'High' ? 'bg-red-50 text-red-700 border border-red-100' : req.priority === 'Medium' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                              {req.priority}
                            </span>
                          </TableCell>
                          <TableCell className="px-5 py-3">
                            {isAdmin || req.userId?.toString() === localStorage.getItem('userId') ? (
                              <Select value={req.status || "Open"} onValueChange={(val) => handleStatusChange(req.id, val)}>
                                <SelectTrigger className={`w-[130px] h-8 text-xs font-bold rounded-lg border-transparent shadow-sm ${req.status === 'Resolved' ? 'bg-emerald-50 text-emerald-700' : req.status === 'In Progress' ? 'bg-indigo-50 text-indigo-700' : req.status === 'Closed' ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-700'}`}>
                                  <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent className="bg-white rounded-xl shadow-lg border-slate-100">
                                  <SelectItem value="Open">Open</SelectItem>
                                  <SelectItem value="In Progress">In Progress</SelectItem>
                                  <SelectItem value="Resolved">Resolved</SelectItem>
                                  <SelectItem value="Closed">Closed</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="flex items-center gap-2 px-2">
                                <span className={`w-2 h-2 rounded-full ${req.status === 'Resolved' ? 'bg-emerald-500' : req.status === 'In Progress' ? 'bg-indigo-500' : req.status === 'Closed' ? 'bg-slate-400' : 'bg-slate-300'}`} />
                                <span className="text-sm font-medium text-slate-700">{req.status || "Open"}</span>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* NEW GEN CREATE TICKET MODAL */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[450px] bg-white p-6 rounded-2xl border-none shadow-2xl">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-xl font-bold text-slate-900">Create Request</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Title *</Label>
              <Input required value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500" placeholder="Brief summary..." />
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Description *</Label>
              <Textarea required placeholder="Please provide details about the issue..." value={description} onChange={(e) => setDescription(e.target.value)} className="h-24 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 resize-none" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Category *</Label>
                <Select required value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent className="bg-white rounded-xl shadow-xl border-slate-100">
                    <SelectItem value="Hardware">Hardware</SelectItem>
                    <SelectItem value="Software">Software</SelectItem>
                    <SelectItem value="Network">Network</SelectItem>
                    <SelectItem value="Access">Access</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Priority *</Label>
                <Select required value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent className="bg-white rounded-xl shadow-xl border-slate-100">
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Tag Users (Optional)</Label>
              <Select onValueChange={(val) => {
                if (!taggedUserIds.includes(val)) setTaggedUserIds([...taggedUserIds, val])
              }}>
                <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500"><SelectValue placeholder="Select staff to tag..." /></SelectTrigger>
                <SelectContent className="bg-white rounded-xl shadow-xl border-slate-100">
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id.toString()}>
                      {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.email} {u.property ? `(${u.property.code})` : '(Global)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {taggedUserIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {taggedUserIds.map(id => {
                    const u = users.find(x => x.id.toString() === id)
                    return (
                      <span key={id} className="bg-indigo-50 text-indigo-700 text-[10px] md:text-xs px-2.5 py-1 rounded-md flex items-center border border-indigo-100 font-semibold">
                        @{u?.firstName || u?.email?.split('@')[0]}
                        <X className="w-3 h-3 ml-1.5 cursor-pointer hover:text-red-500" onClick={() => setTaggedUserIds(taggedUserIds.filter(x => x !== id))} />
                      </span>
                    )
                  })}
                </div>
              )}
            </div>

            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white mt-4 h-11 rounded-xl shadow-lg shadow-indigo-600/20 font-bold tracking-wide">
              Submit Request
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}