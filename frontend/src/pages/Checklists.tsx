import { useState, useEffect, useRef } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Bell, LogOut, CheckCircle2, CheckSquare, Plus, Trash2, Edit, ListChecks, History, FileEdit, X, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

export default function Checklists() {
  const navigate = useNavigate()
  
  const [templates, setTemplates] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  
  const userRole = localStorage.getItem('role') || 'User'
  const isAdmin = userRole === 'Admin' || userRole === 'Super_Admin'

  const [activeTab, setActiveTab] = useState<"pending" | "history" | "templates">("pending")
  const [appSettings, setAppSettings] = useState({ companyName: "IT NextGen", logoUrl: "" })
  const [notifications, setNotifications] = useState<any[]>([])
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // --- Property Filter State ---
  const [allowedProperties, setAllowedProperties] = useState<any[]>([])
  const [activeProperty, setActiveProperty] = useState(localStorage.getItem('activeProperty') || 'All')

  // --- Template Builder State ---
  const [isTemplateOpen, setIsTemplateOpen] = useState(false)
  const [editTemplateId, setEditTemplateId] = useState<number | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [frequency, setFrequency] = useState("Daily")
  const [propertyId, setPropertyId] = useState("Global")
  const [tasks, setTasks] = useState<string[]>([""]) 

  // --- Execute Checklist State ---
  const [isExecuteOpen, setIsExecuteOpen] = useState(false)
  const [executingTemplate, setExecutingTemplate] = useState<any>(null)
  const [taskResponses, setTaskResponses] = useState<Record<string, boolean>>({})
  const [executionNotes, setExecutionNotes] = useState("")

  const prevUnreadCount = useRef<number | null>(null)

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('activeProperty')
    window.location.href = '/login'
  }

  useEffect(() => {
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
          localStorage.setItem('activeProperty', defaultProp)
        }
      })

    const fetchData = async () => {
      try {
        const [tplRes, logRes] = await Promise.all([
          fetch(`/api/checklists?propertyFilter=${activeProperty}`, { headers }),
          fetch(`/api/checklists/logs?propertyFilter=${activeProperty}`, { headers })
        ])
        if (tplRes.ok) setTemplates(await tplRes.json())
        if (logRes.ok) setLogs(await logRes.json())
      } catch (error) { console.error("Failed to fetch checklist data") }
    }

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

    fetchData()
    fetchNotifications() 
    
    const intervalId = setInterval(fetchNotifications, 15000)
    return () => clearInterval(intervalId)
  }, [navigate, activeProperty]) // Re-run when context switches

  const handleContextSwitch = (val: string) => {
    setActiveProperty(val)
    localStorage.setItem('activeProperty', val)
    window.location.reload()
  }

  // --- NOTIFICATION ACTIONS ---
  const markAsRead = async (id: number) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n))
    } catch (error) { console.error("Failed to mark read") }
  }

  const clearNotification = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation() 
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      setNotifications(notifications.filter((n: any) => n.id !== id))
    } catch (error) { console.error("Failed to clear notification") }
  }

  const clearAllNotifications = async () => {
    try {
      await fetch(`/api/notifications`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      setNotifications([])
    } catch (error) { console.error("Failed to clear notifications") }
  }

  // --- Template Builder Logic ---
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    const validTasks = tasks.filter(t => t.trim() !== "")
    if (validTasks.length === 0) return alert("You must add at least one task.")

    const payload = {
      title, description, frequency, tasks: validTasks,
      propertyId: propertyId === "Global" ? null : propertyId
    }

    try {
      const url = editTemplateId ? `/api/checklists/${editTemplateId}` : '/api/checklists'
      const method = editTemplateId ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const savedTemplate = await response.json()
        if (editTemplateId) {
          setTemplates(templates.map(t => t.id === editTemplateId ? savedTemplate : t))
        } else {
          setTemplates([savedTemplate, ...templates])
        }
        setIsTemplateOpen(false)
        resetTemplateForm()
      }
    } catch (error) { alert("Failed to save template") }
  }

  const handleDeleteTemplate = async (id: number) => {
    try {
      const response = await fetch(`/api/checklists/${id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      if (response.ok) setTemplates(templates.filter(t => t.id !== id))
    } catch (error) { alert("Failed to delete template") }
  }

  const openEditTemplate = (tpl: any) => {
    setEditTemplateId(tpl.id)
    setTitle(tpl.title)
    setDescription(tpl.description || "")
    setFrequency(tpl.frequency)
    setPropertyId(tpl.propertyId ? tpl.propertyId.toString() : "Global")
    setTasks(JSON.parse(tpl.tasks))
    setIsTemplateOpen(true)
  }

  const resetTemplateForm = () => {
    setEditTemplateId(null)
    setTitle("")
    setDescription("")
    setFrequency("Daily")
    setPropertyId(userRole === 'Super_Admin' ? "Global" : (allowedProperties.length > 0 ? allowedProperties[0].id.toString() : "Global"))
    setTasks([""])
  }

  // --- Checklist Execution Logic ---
  const openExecuteModal = (tpl: any) => {
    setExecutingTemplate(tpl)
    const parsedTasks = JSON.parse(tpl.tasks)
    const initialResponses: Record<string, boolean> = {}
    parsedTasks.forEach((t: string) => initialResponses[t] = false) 
    setTaskResponses(initialResponses)
    setExecutionNotes("")
    setIsExecuteOpen(true)
  }

  const handleExecuteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch(`/api/checklists/${executingTemplate.id}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ responses: taskResponses, notes: executionNotes })
      })

      if (response.ok) {
        const newLog = await response.json()
        setLogs([newLog, ...logs])
        setIsExecuteOpen(false)
        setActiveTab("history")
      }
    } catch (error) { alert("Failed to submit checklist") }
  }

  const getDisplayName = (u: any) => {
    if (!u) return "Unknown"
    if (u.firstName || u.lastName) return `${u.firstName || ''} ${u.lastName || ''}`.trim()
    return u.email?.split('@')[0] || "Unknown"
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      
      {/* MOBILE-OPTIMIZED TOP RIBBON */}
      <header className="h-16 bg-slate-900 text-white flex items-center justify-between px-4 md:px-6 shrink-0 shadow-md relative z-30">
        <div className="flex items-center gap-3">
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
                            <button onClick={(e) => clearNotification(e, n.id)} className="p-1 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded transition-colors">
                              <X className="w-3 h-3" />
                            </button>
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
        </aside>

        {/* MOBILE-OPTIMIZED MAIN CONTENT */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden w-full">
          <header className="mb-6 md:mb-8">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Routine Checklists</h1>
            <p className="text-xs md:text-sm text-slate-500">Track and log daily, weekly, and monthly IT operations.</p>
          </header>

          {/* MOBILE SCROLLABLE TABS */}
          <div className="flex overflow-x-auto whitespace-nowrap border-b border-slate-200 mb-6 pb-1 md:pb-0 [&::-webkit-scrollbar]:hidden">
            <button onClick={() => setActiveTab("pending")} className={`flex items-center gap-2 px-4 md:px-6 py-3 text-xs md:text-sm font-bold transition-colors shrink-0 ${activeTab === "pending" ? 'bg-white text-indigo-700 border-b-2 border-indigo-600' : 'bg-transparent text-slate-500 hover:bg-white hover:text-slate-700'}`}><CheckSquare className="w-4 h-4"/> Active Checklists</button>
            <button onClick={() => setActiveTab("history")} className={`flex items-center gap-2 px-4 md:px-6 py-3 text-xs md:text-sm font-bold transition-colors shrink-0 ${activeTab === "history" ? 'bg-white text-indigo-700 border-b-2 border-indigo-600' : 'bg-transparent text-slate-500 hover:bg-white hover:text-slate-700'}`}><History className="w-4 h-4"/> Submission History</button>
            {isAdmin && (
              <button onClick={() => setActiveTab("templates")} className={`flex items-center gap-2 px-4 md:px-6 py-3 text-xs md:text-sm font-bold transition-colors shrink-0 ${activeTab === "templates" ? 'bg-white text-indigo-700 border-b-2 border-indigo-600' : 'bg-transparent text-slate-500 hover:bg-white hover:text-slate-700'}`}><FileEdit className="w-4 h-4"/> Manage Templates</button>
            )}
          </div>

          {/* TAB 1: ACTIVE CHECKLISTS */}
          {activeTab === "pending" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {templates.map(tpl => (
                <Card key={tpl.id} className="bg-white border-slate-200 hover:shadow-md transition-all">
                  <CardHeader className="pb-2 p-4 md:p-6">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${tpl.frequency === 'Daily' ? 'bg-emerald-100 text-emerald-700' : tpl.frequency === 'Weekly' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{tpl.frequency}</span>
                      <span className="text-[10px] md:text-xs text-slate-400 font-medium truncate max-w-[120px]">{tpl.property?.name || 'Global'}</span>
                    </div>
                    <CardTitle className="text-base md:text-lg text-slate-900">{tpl.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
                    <p className="text-xs md:text-sm text-slate-500 mb-4 h-8 md:h-10 line-clamp-2">{tpl.description}</p>
                    <div className="text-xs text-slate-400 font-semibold mb-4"><ListChecks className="w-3 h-3 inline mr-1" /> {JSON.parse(tpl.tasks).length} Tasks</div>
                    <Button onClick={() => openExecuteModal(tpl)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">Execute Checklist</Button>
                  </CardContent>
                </Card>
              ))}
              {templates.length === 0 && <div className="col-span-full p-8 md:p-12 text-center text-sm md:text-base text-slate-500">No checklists assigned to your current context.</div>}
            </div>
          )}

          {/* TAB 2: HISTORY */}
          {activeTab === "history" && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden max-w-full">
              {logs.length === 0 ? (
                <div className="p-8 md:p-12 text-center text-sm md:text-base text-slate-500">No checklist history found in this context.</div>
              ) : (
                <div className="overflow-x-auto w-full">
                  <Table className="min-w-[600px] md:min-w-[800px] w-full">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Date / Time</TableHead>
                        <TableHead>Checklist Name</TableHead>
                        <TableHead>Submitted By</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => {
                        const responses = JSON.parse(log.responses)
                        const totalTasks = Object.keys(responses).length
                        const completedTasks = Object.values(responses).filter(Boolean).length
                        const isComplete = completedTasks === totalTasks

                        return (
                          <TableRow key={log.id} className="text-xs md:text-sm">
                            <TableCell className="font-medium text-slate-900 whitespace-nowrap">{new Date(log.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</TableCell>
                            <TableCell className="text-slate-700 font-medium truncate max-w-[150px] md:max-w-none">{log.template?.title}</TableCell>
                            <TableCell className="text-slate-500">{getDisplayName(log.user)}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-0.5 md:px-2.5 md:py-1 rounded-full text-[10px] md:text-xs font-semibold whitespace-nowrap ${isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {completedTasks} / {totalTasks} Completed
                              </span>
                            </TableCell>
                            <TableCell className="text-[10px] md:text-xs text-slate-500 max-w-[150px] md:max-w-[200px] truncate">{log.notes || "-"}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MANAGE TEMPLATES (Admin) */}
          {isAdmin && activeTab === "templates" && (
            <div>
              <div className="flex justify-end mb-4">
                <Button onClick={() => { resetTemplateForm(); setIsTemplateOpen(true); }} className="bg-indigo-600 text-white"><Plus className="w-4 h-4 mr-2" /> Create Template</Button>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden max-w-full">
                {templates.length === 0 ? (
                  <div className="p-8 md:p-12 text-center text-sm md:text-base text-slate-500">No templates found in this context.</div>
                ) : (
                  <div className="overflow-x-auto w-full">
                    <Table className="min-w-[600px] md:min-w-[800px] w-full">
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Frequency</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Tasks</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {templates.map((tpl) => (
                          <TableRow key={tpl.id} className="text-xs md:text-sm">
                            <TableCell className="font-bold text-slate-900 truncate max-w-[150px] md:max-w-none">{tpl.title}</TableCell>
                            <TableCell><span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] md:text-xs font-semibold">{tpl.frequency}</span></TableCell>
                            <TableCell className="text-slate-500">{tpl.property?.name || 'Global'}</TableCell>
                            <TableCell className="text-slate-500">{JSON.parse(tpl.tasks).length} tasks</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => openEditTemplate(tpl)} className="text-blue-600 p-1 md:p-2"><Edit className="w-4 h-4" /></Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-red-600 p-1 md:p-2 ml-1"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                                <AlertDialogContent className="w-[90vw] max-w-[400px] bg-white rounded-xl">
                                  <AlertDialogHeader><AlertDialogTitle>Delete Template?</AlertDialogTitle><AlertDialogDescription className="text-xs md:text-sm">This removes the template. Past logs will be preserved but detached.</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter className="mt-4">
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={() => handleDeleteTemplate(tpl.id)}>Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* CREATE/EDIT TEMPLATE MODAL */}
      <Dialog open={isTemplateOpen} onOpenChange={(open) => { setIsTemplateOpen(open); if(!open) resetTemplateForm(); }}>
        <DialogContent className="w-[90vw] max-w-[550px] bg-white max-h-[90vh] flex flex-col p-4 md:p-6 rounded-xl">
          <DialogHeader><DialogTitle>{editTemplateId ? 'Edit Checklist Template' : 'Build Checklist Template'}</DialogTitle></DialogHeader>
          
          <div className="overflow-y-auto pr-2 py-2 md:py-4 flex-1">
            <form id="templateForm" onSubmit={handleSaveTemplate} className="space-y-4">
              <div className="space-y-2"><Label>Checklist Title *</Label><Input required placeholder="e.g., Server Room Daily Walkthrough" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div className="space-y-2"><Label>Description</Label><Textarea placeholder="Instructions for the team..." value={description} onChange={(e) => setDescription(e.target.value)} /></div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Frequency *</Label>
                  <Select required value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white"><SelectItem value="Daily">Daily</SelectItem><SelectItem value="Weekly">Weekly</SelectItem><SelectItem value="Monthly">Monthly</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Assign to Location</Label>
                  <Select value={propertyId} onValueChange={setPropertyId}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white">
                      {userRole === 'Super_Admin' && <SelectItem value="Global">Global / All Properties</SelectItem>}
                      {allowedProperties.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center mb-2">
                  <Label>Tasks / Action Items</Label>
                  <Button type="button" size="sm" variant="outline" onClick={() => setTasks([...tasks, ""])} className="h-7 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"><Plus className="w-3 h-3 mr-1" /> Add Task</Button>
                </div>
                <div className="space-y-2">
                  {tasks.map((task, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="bg-slate-100 px-2.5 py-1.5 rounded text-xs font-bold text-slate-400 shrink-0">{idx + 1}</div>
                      <Input required placeholder="e.g., Check AC temperature" value={task} onChange={(e) => { const newTasks = [...tasks]; newTasks[idx] = e.target.value; setTasks(newTasks); }} className="text-sm" />
                      <Button type="button" variant="ghost" size="icon" onClick={() => setTasks(tasks.filter((_, i) => i !== idx))} disabled={tasks.length === 1} className="text-red-500 hover:bg-red-50 hover:text-red-700 shrink-0"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                </div>
              </div>
            </form>
          </div>
          
          <div className="pt-4 border-t border-slate-100 mt-auto shrink-0">
            <Button type="submit" form="templateForm" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">Save Template</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* EXECUTE CHECKLIST MODAL */}
      <Dialog open={isExecuteOpen} onOpenChange={setIsExecuteOpen}>
        <DialogContent className="w-[90vw] max-w-[500px] bg-white p-4 md:p-6 rounded-xl max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0"><DialogTitle>{executingTemplate?.title}</DialogTitle><DialogDescription className="text-xs md:text-sm">{executingTemplate?.description}</DialogDescription></DialogHeader>
          
          <form onSubmit={handleExecuteSubmit} className="space-y-4 md:space-y-6 mt-2 md:mt-4 overflow-y-auto pr-2 flex-1">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 md:p-4 space-y-3">
              {executingTemplate && JSON.parse(executingTemplate.tasks).map((task: string, idx: number) => (
                <div key={idx} className="flex items-start gap-3 bg-white p-3 rounded border border-slate-100 shadow-sm transition-colors hover:border-indigo-200 cursor-pointer" onClick={() => setTaskResponses({ ...taskResponses, [task]: !taskResponses[task] })}>
                  <input type="checkbox" checked={taskResponses[task] || false} onChange={() => {}} className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 mt-0.5 cursor-pointer shrink-0" />
                  <Label className={`cursor-pointer leading-snug text-sm ${taskResponses[task] ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{task}</Label>
                </div>
              ))}
            </div>

            <div className="space-y-2"><Label>Completion Notes (Optional)</Label><Textarea placeholder="Any issues found during the check?" value={executionNotes} onChange={(e) => setExecutionNotes(e.target.value)} className="h-20" /></div>
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md">Submit Log</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}