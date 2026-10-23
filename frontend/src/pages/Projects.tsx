import { useState, useEffect, useRef } from "react"
import { useNavigate, useLocation, Link } from "react-router-dom"
import { Search, Bell, LogOut, CheckCircle2, X, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function Projects() {
  const navigate = useNavigate()
  const location = useLocation()
  
  const [projects, setProjects] = useState<any[]>([])
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

    fetch('/api/settings', { headers }).then(res => res.json()).then(data => setAppSettings(data))
    
    // Fetch Context-Filtered Users
    fetch(`/api/users?propertyFilter=${activeProperty}`, { headers }).then(res => res.json()).then(data => setUsers(data))

    // Fetch Allowed Properties for Context Switcher
    fetch('/api/my-properties', { headers })
      .then(res => res.json())
      .then(data => {
        setAllowedProperties(data.properties)
        if (data.role !== 'Super_Admin' && activeProperty === 'All') {
          const defaultProp = data.properties.length > 0 ? data.properties[0].id.toString() : ""
          setActiveProperty(defaultProp)
          localStorage.setItem('activeProperty', defaultProp)
        }
      })

    const fetchProjects = async () => {
      try {
        const response = await fetch(`/api/projects?propertyFilter=${activeProperty}`, { headers })
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

    fetchProjects()
    fetchNotifications() 
    
    const intervalId = setInterval(fetchNotifications, 15000)
    return () => clearInterval(intervalId)
  }, [navigate, activeProperty]) // Re-run when context switches

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
      const response = await fetch('/api/projects', {
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

  const displayedProjects = projects.filter(p => {
    const matchesTab = activeTab === "All" || p.status === activeTab;
    const matchesSearch = (p.title && p.title.toLowerCase().includes(searchQuery.toLowerCase())) || 
                          (p.projectNum && p.projectNum.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      
      {/* MOBILE-OPTIMIZED TOP RIBBON */}
      <header className="h-16 bg-slate-900 text-white flex items-center justify-between px-4 md:px-6 shrink-0 shadow-md relative z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 text-slate-300 hover:text-white focus:outline-none">
            <Menu className="w-6 h-6" />
          </button>
          
          {appSettings.logoUrl && (
            <img src={`${appSettings.logoUrl}`} alt="Logo" className="h-8 md:h-10 w-auto bg-white/10 rounded p-1 object-contain hidden sm:block" />
          )}
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
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center border-2 border-slate-900">
                  {unreadCount}
                </span>
              )}
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
            <Button variant="secondary" className="w-full text-slate-900 font-semibold bg-slate-100 hover:bg-white" onClick={() => { setIsMobileMenuOpen(false); openNewProjectModal(); }}>
              Draft New Project
            </Button>
          </div>
        </aside>

        {/* MOBILE-OPTIMIZED MAIN CONTENT */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden w-full">
          <header className="mb-6 md:mb-8">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Project Portfolio</h1>
            <p className="text-xs md:text-sm text-slate-500">Track capex requests, vendor quotes, and execution timelines.</p>
          </header>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8">
            {["All", "Scoping", "Quoting", "Approved", "Execution"].map(status => (
              <Card key={status} className={`cursor-pointer transition-colors ${activeTab === status ? "ring-2 ring-indigo-900 bg-indigo-50" : "hover:bg-slate-50"}`} onClick={() => setActiveTab(status)}>
                <CardHeader className="pb-1 md:pb-2 p-3 md:p-6"><CardTitle className="text-xs md:text-sm font-medium text-slate-500">{status}</CardTitle></CardHeader>
                <CardContent className="p-3 pt-0 md:p-6 md:pt-0"><div className="text-xl md:text-2xl font-bold text-slate-900">{status === "All" ? projects.length : projects.filter(p => p.status === status).length}</div></CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-between mb-4">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search projects by ID or title..." 
                className="pl-10 bg-white text-sm md:text-base h-10 md:h-12"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {/* Mobile Action Button */}
            <Button onClick={openNewProjectModal} className="md:hidden w-full bg-slate-900 text-white h-10">
              Draft New Project
            </Button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8 max-w-full">
            {loading ? (
              <div className="p-8 md:p-12 text-center text-slate-500 text-sm md:text-base">Loading projects...</div>
            ) : displayedProjects.length === 0 ? (
              <div className="p-8 md:p-12 text-center text-slate-500 text-sm md:text-base">No projects found in this context.</div>
            ) : (
              // MOBILE TABLE WRAPPER
              <div className="overflow-x-auto w-full">
                <Table className="min-w-[800px] w-full">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[100px] md:w-[120px]">Project ID</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Budget</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedProjects.map((proj) => (
                      <TableRow key={proj.id}>
                        <TableCell className="font-medium text-slate-900 text-xs md:text-sm">
                          <Link to={`/projects/${proj.id}`} className="hover:underline hover:text-indigo-600">
                            {proj.projectNum}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs md:text-sm max-w-[200px] md:max-w-xs">
                          <div className="font-medium truncate">{proj.title}</div>
                          <div className="text-[10px] md:text-xs text-slate-500 truncate">{proj.description}</div>
                          
                          {proj.taggedUsers && proj.taggedUsers.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {proj.taggedUsers.map((tu: any) => (
                                <span key={tu.id} className="bg-indigo-50 text-indigo-600 border border-indigo-100 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                  @{tu.firstName || tu.email.split('@')[0]}
                                </span>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs md:text-sm">{proj.property ? proj.property.name : "Global"}</TableCell>
                        <TableCell className="text-xs md:text-sm">{proj.budget ? proj.budget.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }) : "TBD"}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 md:px-2.5 md:py-1 rounded-full text-[10px] md:text-xs font-semibold ${
                            proj.status === 'Execution' ? 'bg-indigo-100 text-indigo-700' : 
                            proj.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {proj.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* CREATE MODAL */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[450px] bg-white p-4 md:p-6 rounded-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Draft New Project</DialogTitle>
            <DialogDescription className="text-xs md:text-sm">Define the initial scope for a new IT project.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-4 mt-2 md:mt-4">
            <div className="space-y-2"><Label>Title *</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            
            <div className="space-y-2">
              <Label>Scope / Description *</Label>
              <Textarea required placeholder="Provide the initial project scope..." value={description} onChange={(e) => setDescription(e.target.value)} className="h-20" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Property / Hotel</Label>
                <Select value={propertyId} onValueChange={setPropertyId}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {userRole === 'Super_Admin' && <SelectItem value="Global">Global / Corporate</SelectItem>}
                    {allowedProperties.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2"><Label>Priority *</Label>
                <Select required value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Est. Budget (₹)</Label><Input type="number" placeholder="Optional" value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
              <div className="space-y-2"><Label>Target Date</Label><Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></div>
            </div>

            {/* TAGGING UI */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <Label>Project Members</Label>
              <Select onValueChange={(val) => {
                if (!taggedUserIds.includes(val)) setTaggedUserIds([...taggedUserIds, val])
              }}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Add stakeholders..." /></SelectTrigger>
                <SelectContent className="bg-white">
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
                      <span key={id} className="bg-indigo-50 text-indigo-700 text-[10px] md:text-xs px-2 py-1 rounded-md flex items-center border border-indigo-100">
                        @{u?.firstName || u?.email?.split('@')[0]}
                        <X className="w-3 h-3 ml-1 cursor-pointer hover:text-red-500" onClick={() => setTaggedUserIds(taggedUserIds.filter(x => x !== id))} />
                      </span>
                    )
                  })}
                </div>
              )}
            </div>

            <Button type="submit" className="w-full bg-slate-900 text-white mt-2">Initialize Project</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}