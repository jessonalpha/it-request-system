import { useState, useEffect, useRef } from "react"
import { useNavigate, useLocation, Link } from "react-router-dom"
import { Search, Bell, LogOut, CheckCircle2, X, Menu, Folder, SearchCode, FileText, CheckCircle, Rocket, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function Projects() {
  const navigate = useNavigate()
  const location = useLocation()
  
  const [projects, setProjects] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([]) 
  const [properties, setProperties] = useState<any[]>([]) // Added missing state
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>((location.state as any)?.filter || "All")
  const [searchQuery, setSearchQuery] = useState("")
  
  const userRole = localStorage.getItem('role') || 'User'
  const isAdmin = userRole === 'Admin' || userRole === 'Super_Admin'

  const [appSettings, setAppSettings] = useState({ companyName: "IT NextGen", logoUrl: "" })
  const [notifications, setNotifications] = useState<any[]>([])
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // --- Property Filter State ---
  const [allowedProperties, setAllowedProperties] = useState<any[]>([])
  const [activeProperty, setActiveProperty] = useState(localStorage.getItem('activeProperty') || 'All')

  // --- New Project State ---
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("") 
  const [priority, setPriority] = useState("")
  const [budget, setBudget] = useState("")
  const [targetDate, setTargetDate] = useState("")
  const [propertyId, setPropertyId] = useState("Global")
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>([]) 

  const [myPermissions, setMyPermissions] = useState<Record<string, any>>({})

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('activeProperty')
    window.location.href = '/login'
  }
  
  const prevUnreadCount = useRef<number | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    const headers = { 'Authorization': `Bearer ${token}` }

    fetch('http://localhost:5000/api/users/me/permissions', { headers })
      .then(res => res.ok ? res.json() : { permissions: {} })
      .then((data: any) => setMyPermissions(data.permissions || {}))
      .catch(() => setMyPermissions({}))

    fetch('http://localhost:5000/api/settings', { headers }).then(res => res.json()).then((data: any) => setAppSettings(data)).catch(() => {})
    
    // Fetch Properties
    fetch('http://localhost:5000/api/properties', { headers }).then(res => res.ok && res.json()).then((data: any) => data && setProperties(data)).catch(() => {})

    // Fetch Context-Filtered Users
    fetch(`http://localhost:5000/api/users?propertyFilter=${activeProperty}`, { headers }).then(res => res.ok && res.json()).then((data: any) => data && setUsers(data)).catch(() => {})

    // Fetch Allowed Properties for Context Switcher
    fetch('http://localhost:5000/api/my-properties', { headers })
      .then(res => res.ok ? res.json() : { properties: [], role: 'User' })
      .then((data: any) => {
        setAllowedProperties(data.properties || [])
        if (data.role !== 'Super_Admin' && activeProperty === 'All') {
          const defaultProp = data.properties && data.properties.length > 0 ? data.properties[0].id.toString() : ""
          setActiveProperty(defaultProp)
          localStorage.setItem('activeProperty', defaultProp)
        }
      }).catch(() => {})

    const fetchProjects = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/projects?propertyFilter=${activeProperty}`, { headers })
        if (response.status === 401 || response.status === 403) return handleLogout()
        if (response.ok) setProjects(await response.json())
      } catch (error) {
        console.error("Failed to fetch projects")
      } finally {
        setLoading(false) 
      }
    }

    const fetchNotifications = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/notifications', { headers })
        if (response.ok) {
          const data = await response.json()
          const currentUnread = data.filter((n: any) => !n.isRead).length
          
          if (prevUnreadCount.current !== null && currentUnread > prevUnreadCount.current) {
            new Audio('/notification.mp3').play().catch(() => {})
          }
          
          prevUnreadCount.current = currentUnread
          setNotifications(data)
        }
      } catch (error) { console.error("Failed to fetch notifications") }
    }

    fetchProjects()
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
      await fetch(`http://localhost:5000/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      setNotifications(notifications.map((n: any) => n.id === id ? { ...n, isRead: true } : n))
    } catch (error) { console.error("Failed to mark read") }
  }

  const clearNotification = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation() 
    try {
      await fetch(`http://localhost:5000/api/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      setNotifications(notifications.filter((n: any) => n.id !== id))
    } catch (error) { console.error("Failed to clear notification") }
  }

  const clearAllNotifications = async () => {
    try {
      await fetch(`http://localhost:5000/api/notifications`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      setNotifications([])
    } catch (error) { console.error("Failed to clear notifications") }
  }

  const openNewProjectModal = () => {
    setTitle("")
    setDescription("")
    setPriority("")
    setBudget("")
    setTargetDate("")
    setTaggedUserIds([])
    // Default the assignment to the current context filter
    setPropertyId(userRole === 'Super_Admin' && activeProperty === 'All' ? 'Global' : (activeProperty !== 'All' ? activeProperty : (allowedProperties.length > 0 ? allowedProperties[0].id.toString() : 'Global')))
    setIsDialogOpen(true)
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !description || !priority) return alert("Please fill out all required fields!")

    try {
      const response = await fetch('http://localhost:5000/api/projects', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          title, description, priority, 
          budget: budget || null, 
          targetDate: targetDate || null, 
          propertyId: propertyId === "Global" ? null : propertyId,
          taggedUserIds 
        }), 
      })

      if (response.ok) {
        const newProject = await response.json()
        setProjects([newProject, ...projects]) 
        setIsDialogOpen(false)
        setActiveTab("All")
      }
    } catch (error) { alert("Network Error") }
  }

  // Modern Metrics Grid Arrays (Explicitly typed as any)
  const metrics = [
    { title: "All Projects", value: projects.length, icon: Folder, color: "text-slate-600", bg: "bg-slate-100", filter: "All" },
    { title: "Scoping", value: projects.filter((p: any) => p.status === "Scoping").length, icon: SearchCode, color: "text-amber-600", bg: "bg-amber-50", filter: "Scoping" },
    { title: "Quoting", value: projects.filter((p: any) => p.status === "Quoting").length, icon: FileText, color: "text-blue-600", bg: "bg-blue-50", filter: "Quoting" },
    { title: "Approved", value: projects.filter((p: any) => p.status === "Approved").length, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50", filter: "Approved" },
    { title: "Execution", value: projects.filter((p: any) => p.status === "Execution").length, icon: Rocket, color: "text-indigo-600", bg: "bg-indigo-50", filter: "Execution" },
  ]

  const displayedProjects = projects.filter((p: any) => {
    const matchesTab = activeTab === "All" || p.status === activeTab;
    const matchesSearch = (p.title && p.title.toLowerCase().includes(searchQuery.toLowerCase())) || 
                          (p.projectNum && p.projectNum.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  const unreadCount = notifications.filter((n: any) => !n.isRead).length
  const canCreateProjects = isAdmin || !!myPermissions.create_projects;

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC]">
      
      {/* MOBILE-OPTIMIZED TOP RIBBON */}
      <header className="h-16 bg-slate-900 text-white flex items-center justify-between px-4 md:px-6 shrink-0 shadow-md relative z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 text-slate-300 hover:text-white focus:outline-none">
            <Menu className="w-6 h-6" />
          </button>
          
          {appSettings.logoUrl && (
            <img src={`http://localhost:5000${appSettings.logoUrl}`} alt="Logo" className="h-8 md:h-10 w-auto rounded p-1 object-contain hidden sm:block" />
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
                  {allowedProperties.map((p: any) => (
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
                  {allowedProperties.map((p: any) => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <nav className="space-y-4 overflow-y-auto flex-1">
            <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/dashboard') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300 transition-colors'}`}>Dashboard</Link>
            <Link to="/tickets" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/tickets') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300 transition-colors'}`}>Tickets</Link>
            <Link to="/projects" onClick={() => setIsMobileMenuOpen(false)} className={`block text-white font-medium`}>Projects</Link>
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

          {canCreateProjects && (
            <Button onClick={() => { setIsMobileMenuOpen(false); openNewProjectModal(); }} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold mt-6 shrink-0 rounded-xl shadow-lg shadow-indigo-900/20">
              Draft New Project
            </Button>
          )}
        </aside>

        {/* MODERN MAIN CONTENT */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden w-full">
          <div className="max-w-7xl mx-auto">
            <header className="mb-8 flex justify-between items-end">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Project Portfolio</h1>
                <p className="text-sm text-slate-500 mt-1">Track capex requests, vendor quotes, and execution timelines.</p>
              </div>
              
              {/* Mobile "New Project" action button */}
              {canCreateProjects && (
                <Button onClick={openNewProjectModal} className="md:hidden bg-indigo-600 text-white h-10 px-4 rounded-xl shadow-md">
                  New Project
                </Button>
              )}
            </header>

            {/* 5-COLUMN NEW GEN METRICS GRID */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mb-8">
              {metrics.map((metric, idx) => (
                <Card 
                  key={idx} 
                  onClick={() => setActiveTab(metric.filter)}
                  className={`cursor-pointer border-none transition-all rounded-2xl group relative overflow-hidden ${activeTab === metric.filter ? 'ring-2 ring-indigo-600 bg-white shadow-md' : 'shadow-sm hover:shadow-md bg-white opacity-80 hover:opacity-100'}`} 
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardContent className="p-4 md:p-5 relative z-10 flex flex-col justify-between min-h-[100px]">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-[11px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">{metric.title}</p>
                      <div className={`p-2 rounded-lg ${metric.bg} ${metric.color} shrink-0`}>
                        <metric.icon className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2.5} />
                      </div>
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">{metric.value}</h3>
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
                    placeholder="Search projects by ID or title..." 
                    className="pl-10 h-10 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 w-full"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="overflow-x-auto w-full">
                <Table className="min-w-[800px] w-full">
                  <TableHeader>
                    <TableRow className="border-b border-slate-100 bg-slate-50/50 hover:bg-slate-50/50">
                      <TableHead className="font-semibold text-slate-500 h-11 px-5 text-[11px] uppercase tracking-wider w-[120px]">Project ID</TableHead>
                      <TableHead className="font-semibold text-slate-500 h-11 px-5 text-[11px] uppercase tracking-wider">Details</TableHead>
                      <TableHead className="font-semibold text-slate-500 h-11 px-5 text-[11px] uppercase tracking-wider">Location</TableHead>
                      <TableHead className="font-semibold text-slate-500 h-11 px-5 text-[11px] uppercase tracking-wider text-right">Budget</TableHead>
                      <TableHead className="font-semibold text-slate-500 h-11 px-5 text-[11px] uppercase tracking-wider">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={5} className="text-center py-12 text-slate-400 text-sm border-none">
                          Loading projects...
                        </TableCell>
                      </TableRow>
                    ) : displayedProjects.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={5} className="text-center py-12 text-slate-400 text-sm border-none">
                          No projects found matching your criteria.
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayedProjects.map((proj: any) => (
                        <TableRow key={proj.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors group">
                          <TableCell className="px-5 py-3 font-semibold text-slate-700 text-xs">
                            <Link to={`/projects/${proj.id}`} className="group-hover:text-indigo-600 transition-colors flex items-center">
                              {proj.projectNum}
                              <ChevronRight className="w-3.5 h-3.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                          </TableCell>
                          <TableCell className="px-5 py-3">
                            <div className="font-medium text-slate-900 text-sm mb-0.5 truncate max-w-[250px] md:max-w-md">{proj.title}</div>
                            <div className="text-xs text-slate-500 truncate max-w-[250px] md:max-w-md mb-2">{proj.description}</div>
                            
                            {proj.taggedUsers && proj.taggedUsers.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {proj.taggedUsers.map((tu: any) => (
                                  <span key={tu.id} className="text-[9px] font-bold tracking-wider text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase">
                                    @{tu.firstName || tu.email.split('@')[0]}
                                  </span>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="px-5 py-3 text-slate-600 text-sm font-medium">{proj.property ? proj.property.name : "Global / Corp"}</TableCell>
                          <TableCell className="px-5 py-3 text-right font-semibold text-slate-700 text-sm">
                            {proj.budget ? proj.budget.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }) : "TBD"}
                          </TableCell>
                          <TableCell className="px-5 py-3">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide border ${
                              proj.status === 'Completed' ? 'bg-slate-100 text-slate-600 border-slate-200' : 
                              proj.status === 'Execution' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 
                              proj.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                              'bg-white text-slate-700 border-slate-200 shadow-sm'
                            }`}>
                              {proj.status}
                            </span>
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

      {/* NEW GEN CREATE PROJECT MODAL */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[450px] bg-white p-6 rounded-2xl border-none shadow-2xl">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-xl font-bold text-slate-900">Draft New Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-4 max-h-[75vh] overflow-y-auto pr-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Title *</Label>
              <Input required value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500" placeholder="e.g. WiFi Upgrade" />
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Scope / Details *</Label>
              <Textarea required placeholder="Provide the initial project scope..." value={description} onChange={(e) => setDescription(e.target.value)} className="h-24 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 resize-none" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Property</Label>
                <Select value={propertyId} onValueChange={setPropertyId}>
                  <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500"><SelectValue/></SelectTrigger>
                  <SelectContent className="bg-white rounded-xl shadow-xl border-slate-100">
                    <SelectItem value="Global">Global / Corporate</SelectItem>
                    {properties.map((p: any) => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Priority *</Label>
                <Select required value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500"><SelectValue placeholder="Select..."/></SelectTrigger>
                  <SelectContent className="bg-white rounded-xl shadow-xl border-slate-100">
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Est. Budget (₹)</Label>
                <Input type="number" placeholder="Optional" value={budget} onChange={(e) => setBudget(e.target.value)} className="h-10 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500"/>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Target Date</Label>
                <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="h-10 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500"/>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Tag Stakeholders (Optional)</Label>
              <Select onValueChange={(val) => {
                if (!taggedUserIds.includes(val)) setTaggedUserIds([...taggedUserIds, val])
              }}>
                <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500"><SelectValue placeholder="Add stakeholders..." /></SelectTrigger>
                <SelectContent className="bg-white rounded-xl shadow-xl border-slate-100">
                  {users.map((u: any) => (
                    <SelectItem key={u.id} value={u.id.toString()}>
                      {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.email} {u.property ? `(${u.property.code})` : '(Global)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {taggedUserIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {taggedUserIds.map((id: string) => {
                    const u = users.find((x: any) => x.id.toString() === id)
                    return (
                      <span key={id} className="bg-indigo-50 text-indigo-700 text-[10px] md:text-xs px-2.5 py-1 rounded-md flex items-center border border-indigo-100 font-semibold">
                        @{u?.firstName || u?.email?.split('@')[0]}
                        <X className="w-3 h-3 ml-1.5 cursor-pointer hover:text-red-500" onClick={() => setTaggedUserIds(taggedUserIds.filter((x: string) => x !== id))} />
                      </span>
                    )
                  })}
                </div>
              )}
            </div>

            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white mt-4 h-11 rounded-xl shadow-lg shadow-indigo-600/20 font-bold tracking-wide">
              Initialize Project
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}