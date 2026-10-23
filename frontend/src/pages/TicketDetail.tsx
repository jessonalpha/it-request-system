import { useState, useEffect, useRef } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { Paperclip, Send, X, FileText, Trash2, Edit, Bell, LogOut, CheckCircle2, Menu, ArrowLeft, Clock, User, Tag, LayoutDashboard, AlertCircle, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

export default function TicketDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [ticket, setTicket] = useState<any>(null)
  const [newMessage, setNewMessage] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [users, setUsers] = useState<any[]>([]) 
  const [loading, setLoading] = useState(true)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const commentsEndRef = useRef<HTMLDivElement>(null)
  
  const userRole = localStorage.getItem('role') || 'User'
  const isAdmin = userRole === 'Admin' || userRole === 'Super_Admin'

  // --- Global State ---
  const [appSettings, setAppSettings] = useState({ companyName: "IT NextGen", logoUrl: "" })
  const [notifications, setNotifications] = useState<any[]>([])
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // --- Edit Ticket State ---
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("") 
  const [editCategory, setEditCategory] = useState("")
  const [editPriority, setEditPriority] = useState("")
  const [editTaggedUserIds, setEditTaggedUserIds] = useState<string[]>([])

  const prevUnreadCount = useRef<number | null>(null)

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    window.location.href = '/login'
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return 
    }
    
    const headers = { 'Authorization': `Bearer ${token}` }

    fetch('/api/settings', { headers }).then(res => res.json()).then(data => setAppSettings(data)).catch(err => console.error(err))
    fetch('/api/users', { headers }).then(res => res.json()).then(data => setUsers(data)).catch(err => console.error(err))

    const fetchTicketData = async () => {
      try {
        const response = await fetch(`/api/requests/${id}`, { headers })
        if (response.status === 401 || response.status === 403) return handleLogout()
        if (response.ok) setTicket(await response.json())
      } catch (error) {
        console.error("Failed to fetch ticket details")
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
      } catch (error) { console.error("Failed to fetch notifications") }
    }

    fetchTicketData()
    fetchNotifications()
    
    const intervalId = setInterval(fetchNotifications, 15000)
    return () => clearInterval(intervalId)
  }, [id, navigate])

  // Auto-scroll to bottom of comments
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [ticket?.comments])

  // --- Notification Handlers ---
  const markAsRead = async (notifId: number) => {
    try {
      await fetch(`/api/notifications/${notifId}/read`, {
        method: 'PATCH', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      setNotifications(notifications.map(n => n.id === notifId ? { ...n, isRead: true } : n))
    } catch (error) { console.error("Failed to mark read") }
  }

  const clearNotification = async (e: React.MouseEvent, notifId: number) => {
    e.stopPropagation() 
    try {
      await fetch(`/api/notifications/${notifId}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      setNotifications(notifications.filter((n: any) => n.id !== notifId))
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

  // --- Ticket Actions ---
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() && !selectedFile) return

    const formData = new FormData()
    formData.append("message", newMessage)
    if (selectedFile) formData.append("document", selectedFile)

    try {
      const response = await fetch(`/api/requests/${id}/comments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      })

      if (response.ok) {
        const comment = await response.json()
        setTicket({ ...ticket, comments: [...ticket.comments, comment] })
        setNewMessage("")
        setSelectedFile(null)
      }
    } catch (error) { console.error("Failed to post comment", error) }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/requests/${id}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: newStatus }),
      })
      if (response.ok) {
        setTicket({ ...ticket, status: newStatus })
      }
    } catch (error) { console.error("Failed to update status") }
  }

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/requests/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      if (response.ok) navigate('/tickets')
    } catch (error) { alert("Network Error while deleting") }
  }

  const openEditModal = () => {
    setEditTitle(ticket.title)
    setEditDescription(ticket.description || "") 
    setEditCategory(ticket.category)
    setEditPriority(ticket.priority)
    if (ticket.taggedUsers) {
        setEditTaggedUserIds(ticket.taggedUsers.map((tu: any) => tu.id.toString()))
    } else {
        setEditTaggedUserIds([])
    }
    setIsEditOpen(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editCategory || !editPriority) return alert("Please select a category and priority.")

    try {
      const response = await fetch(`/api/requests/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
            title: editTitle, 
            description: editDescription, 
            category: editCategory, 
            priority: editPriority, 
            taggedUserIds: editTaggedUserIds
        }), 
      })

      if (response.ok) {
        const updatedTicket = await response.json()
        setTicket(updatedTicket) 
        setIsEditOpen(false)
      }
    } catch (error) { alert("Network Error") }
  }

  const getDisplayName = (u: any) => {
    if (!u) return "Unknown"
    if (u.firstName || u.lastName) return `${u.firstName || ''} ${u.lastName || ''}`.trim()
    return u.email?.split('@')[0] || "Unknown"
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-100 text-slate-500">Loading ticket details...</div>
  if (!ticket) return <div className="flex h-screen items-center justify-center bg-slate-100 text-slate-500">Ticket not found or access denied.</div>

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

          <nav className="space-y-4 overflow-y-auto flex-1">
            <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/dashboard') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300'}`}>Dashboard</Link>
            <Link to="/tickets" onClick={() => setIsMobileMenuOpen(false)} className={`block text-white font-medium`}>Tickets</Link>
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

        {/* MAIN SPLIT CONTENT */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden w-full flex flex-col lg:flex-row gap-6">
          
          {/* TICKET DETAILS COLUMN */}
          <div className="flex-1 space-y-6">
            <div>
              <button onClick={() => navigate('/tickets')} className="flex items-center text-xs md:text-sm text-slate-500 hover:text-indigo-600 mb-4 transition-colors font-medium">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Tickets
              </button>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-xl md:text-3xl font-bold text-slate-900 leading-tight">
                  <span className="text-slate-400 mr-2">#{ticket.ticketNum}</span>
                  {ticket.title}
                </h1>
                
                <div className="flex items-center gap-2 shrink-0">
                  {isAdmin ? (
                    <>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:block">Status:</span>
                      <Select value={ticket.status || "Open"} onValueChange={handleStatusChange}>
                        <SelectTrigger className="w-[140px] bg-white h-9 text-xs md:text-sm font-semibold border-slate-300 focus:ring-indigo-500">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="Open">Open</SelectItem>
                          <SelectItem value="In Progress">In Progress</SelectItem>
                          <SelectItem value="Resolved">Resolved</SelectItem>
                          <SelectItem value="Closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button variant="outline" size="icon" onClick={openEditModal} className="h-9 w-9 text-blue-600 hover:text-blue-800 border-slate-300">
                        <Edit className="w-4 h-4" />
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="icon" className="h-9 w-9 text-red-600 hover:text-red-800 border-slate-300">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="w-[90vw] max-w-[400px] bg-white rounded-xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Ticket?</AlertDialogTitle>
                            <AlertDialogDescription className="text-xs md:text-sm">This action cannot be undone and will permanently erase this ticket and all its comments.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="mt-4">
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete}>Delete Ticket</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  ) : (
                    <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-md shadow-sm">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-2">Status:</span>
                      <span className="text-xs md:text-sm font-bold text-slate-800">{ticket.status || "Open"}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Card className="bg-white border-slate-200 shadow-sm">
              <CardContent className="p-4 md:p-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 pb-6 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Priority</div>
                    <div className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-bold ${
                      ticket.priority === 'High' ? 'bg-red-100 text-red-700' : 
                      ticket.priority === 'Medium' ? 'bg-amber-100 text-amber-700' : 
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {ticket.priority}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1"><LayoutDashboard className="w-3 h-3" /> Category</div>
                    <div className="text-xs md:text-sm font-semibold text-slate-700">{ticket.category}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1"><User className="w-3 h-3" /> Requester</div>
                    <div className="text-xs md:text-sm font-semibold text-slate-700 truncate">{getDisplayName(ticket.user)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1"><Clock className="w-3 h-3" /> Created</div>
                    <div className="text-xs md:text-sm font-semibold text-slate-700">{new Date(ticket.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] md:text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Description</h3>
                  <div className="text-xs md:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 p-3 md:p-4 rounded-lg border border-slate-100">
                    {ticket.description}
                  </div>
                </div>

                {ticket.taggedUsers && ticket.taggedUsers.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <h3 className="text-[10px] md:text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1">
                      <Tag className="w-3 h-3" /> Tagged Personnel
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {ticket.taggedUsers.map((tu: any) => (
                        <span key={tu.id} className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] md:text-xs font-semibold px-2 py-1 rounded-md flex items-center gap-1.5">
                          <User className="w-3 h-3" /> @{tu.firstName || tu.email.split('@')[0]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* COMMENTS COLUMN */}
          <div className="w-full lg:w-[450px] shrink-0 flex flex-col h-[500px] lg:h-[calc(100vh-10rem)] max-h-[800px]">
            <Card className="flex flex-col h-full bg-white border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="p-3 md:p-4 border-b border-slate-100 bg-slate-50 shrink-0">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                  <MessageSquare className="w-4 h-4 text-indigo-500" />
                  Ticket Discussion
                </CardTitle>
              </CardHeader>
              
              <CardContent className="p-0 flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                  {ticket.comments?.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                      <MessageSquare className="w-8 h-8 opacity-20" />
                      <p className="text-xs">No comments yet. Start the conversation!</p>
                    </div>
                  ) : (
                    ticket.comments?.map((comment: any) => {
                      // Modern Chat Bubble Logic
                      const isMe = comment.user?.email === localStorage.getItem('email') || comment.user?.id?.toString() === localStorage.getItem('userId')

                      return (
                        <div key={comment.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <span className="text-[9px] md:text-[10px] font-semibold text-slate-400 mb-1 px-1">
                            {getDisplayName(comment.user)} • {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          
                          <div className={`px-3 md:px-4 py-2 md:py-2.5 rounded-2xl max-w-[85%] text-xs md:text-sm shadow-sm flex flex-col gap-2 ${
                            isMe 
                              ? 'bg-indigo-600 text-white rounded-tr-none' 
                              : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'
                          }`}>
                            {comment.message && <span className="whitespace-pre-wrap leading-relaxed">{comment.message}</span>}
                            
                            {comment.fileUrl && (
                              <a 
                                href={`${comment.fileUrl}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                                  isMe 
                                    ? 'bg-indigo-700 hover:bg-indigo-800 text-white' 
                                    : 'bg-slate-100 hover:bg-slate-200 text-indigo-700'
                                }`}
                              >
                                <FileText className="w-4 h-4 shrink-0" />
                                <span className="truncate max-w-[150px]">{comment.fileName}</span>
                              </a>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={commentsEndRef} />
                </div>

                {/* POST COMMENT BOX */}
                <div className="p-3 md:p-4 bg-white border-t border-slate-100 shrink-0">
                  {selectedFile && (
                    <div className="flex items-center gap-2 mb-3 p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-xs font-semibold text-indigo-700 inline-flex w-full">
                      <FileText className="w-4 h-4 shrink-0" />
                      <span className="truncate flex-1">{selectedFile.name}</span>
                      <button onClick={() => setSelectedFile(null)} className="hover:bg-indigo-100 p-1 rounded transition-colors shrink-0"><X className="w-3 h-3" /></button>
                    </div>
                  )}
                  
                  <form onSubmit={handlePostComment} className="flex gap-2 relative">
                    <input 
                      type="file" 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                    />
                    
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => fileInputRef.current?.click()} 
                      className="h-[44px] w-[44px] shrink-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border-slate-200 p-0 rounded-xl"
                    >
                      <Paperclip className="w-5 h-5" />
                    </Button>
                    
                    <Textarea 
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a reply..."
                      className="min-h-[44px] h-[44px] max-h-[120px] resize-none text-sm py-3 rounded-xl border-slate-200 focus-visible:ring-indigo-500 pr-12"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handlePostComment(e)
                        }
                      }}
                    />
                    
                    <Button 
                      type="submit" 
                      disabled={!newMessage.trim() && !selectedFile} 
                      className="absolute right-1 bottom-1 h-[36px] w-[36px] bg-indigo-600 hover:bg-indigo-700 text-white p-0 flex items-center justify-center rounded-lg transition-all disabled:opacity-50 disabled:bg-slate-300"
                    >
                      <Send className="w-4 h-4 ml-0.5" />
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </div>

        </main>
      </div>

      {/* EDIT MODAL */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="w-[90vw] max-w-[425px] bg-white p-4 md:p-6 rounded-xl">
          <DialogHeader>
            <DialogTitle>Edit Ticket</DialogTitle>
            <DialogDescription className="text-xs md:text-sm">Update the metadata or re-assign tags for this ticket.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 mt-2 md:mt-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-2"><Label>Title *</Label><Input required value={editTitle} onChange={(e) => setEditTitle(e.target.value)} /></div>
            
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea required className="min-h-[100px]" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Category *</Label>
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="Hardware">Hardware</SelectItem>
                    <SelectItem value="Software">Software</SelectItem>
                    <SelectItem value="Network">Network</SelectItem>
                    <SelectItem value="Access">Access</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2"><Label>Priority *</Label>
                <Select value={editPriority} onValueChange={setEditPriority}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <Label>Modify Tags</Label>
              <Select onValueChange={(val) => {
                if (!editTaggedUserIds.includes(val)) setEditTaggedUserIds([...editTaggedUserIds, val])
              }}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Add another user..." /></SelectTrigger>
                <SelectContent className="bg-white">
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id.toString()}>
                      {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.email} {u.property ? `(${u.property.code})` : '(Global)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {editTaggedUserIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {editTaggedUserIds.map(id => {
                    const u = users.find(x => x.id.toString() === id)
                    return (
                      <span key={id} className="bg-indigo-50 text-indigo-700 text-[10px] md:text-xs px-2 py-1 rounded-md flex items-center border border-indigo-100">
                        @{u?.firstName || u?.email?.split('@')[0]}
                        <X className="w-3 h-3 ml-1 cursor-pointer hover:text-red-500" onClick={() => setEditTaggedUserIds(editTaggedUserIds.filter(x => x !== id))} />
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
            
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-4">Save Changes</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}