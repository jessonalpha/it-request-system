import React, { useState, useEffect, useRef } from "react"
import { useNavigate, Link } from "react-router-dom"
import { 
  Search, Bell, LogOut, X, Menu, FileText, Download, Trash2, 
  Upload, Eye, LayoutGrid, List, File, FileCode, FileSpreadsheet, 
  FileArchive, Image as ImageIcon, Copy, Check, Plus, FolderOpen, 
  ExternalLink, Building2, Globe, Pencil 
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function ResourceHub() {
  const navigate = useNavigate()
  
  const [resources, setResources] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState("All")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  const userRole = localStorage.getItem('role') || 'User'
  const isAdmin = userRole === 'Admin' || userRole === 'Super_Admin'

  const [appSettings, setAppSettings] = useState({ companyName: "IT NextGen", logoUrl: "" })
  const [notifications, setNotifications] = useState<any[]>([])
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Property Filter State
  const [allowedProperties, setAllowedProperties] = useState<any[]>([])
  const [activeProperty, setActiveProperty] = useState(localStorage.getItem('activeProperty') || 'All')

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("SOPs")
  const [propertyId, setPropertyId] = useState("Global")
  const [description, setDescription] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editCategory, setEditCategory] = useState("SOPs")
  const [editPropertyId, setEditPropertyId] = useState("Global")
  const [editDescription, setEditDescription] = useState("")
  const [editFile, setEditFile] = useState<File | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  // Preview Modal State
  const [previewResource, setPreviewResource] = useState<any | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)

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

    fetch('/api/settings', { headers }).then(res => res.json()).then(data => setAppSettings(data)).catch(() => {})

    fetch('/api/my-properties', { headers })
      .then(res => res.ok ? res.json() : { properties: [], role: 'User' })
      .then(data => {
        setAllowedProperties(data.properties || [])
        if (data.role !== 'Super_Admin' && activeProperty === 'All') {
          const defaultProp = data.properties && data.properties.length > 0 ? data.properties[0].id.toString() : ""
          setActiveProperty(defaultProp)
          localStorage.setItem('activeProperty', defaultProp)
        }
      }).catch(() => {})

    const fetchResources = async () => {
      try {
        const response = await fetch(`/api/resources?propertyFilter=${activeProperty}`, { headers })
        if (response.status === 401 || response.status === 403) return handleLogout()
        if (response.ok) setResources(await response.json())
      } catch (error) {
        console.error("Failed to fetch resources")
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

    fetchResources()
    fetchNotifications()

    const intervalId = setInterval(fetchNotifications, 15000)
    return () => clearInterval(intervalId)
  }, [navigate, activeProperty])

  const handleContextSwitch = (val: string) => {
    setActiveProperty(val)
    localStorage.setItem('activeProperty', val)
    window.location.reload()
  }

  const openUploadModal = () => {
    setTitle("")
    setDescription("")
    setCategory("SOPs")
    setSelectedFile(null)
    setPropertyId(
      userRole === 'Super_Admin' && activeProperty === 'All'
        ? 'Global'
        : activeProperty !== 'All'
        ? activeProperty
        : allowedProperties.length > 0
        ? allowedProperties[0].id.toString()
        : 'Global'
    )
    setIsUploadOpen(true)
  }

  const openEditModal = (res: any) => {
    setEditId(res.id)
    setEditTitle(res.title || "")
    setEditCategory(res.category || "SOPs")
    setEditPropertyId(res.propertyId ? res.propertyId.toString() : "Global")
    setEditDescription(res.description || "")
    setEditFile(null)
    setIsEditOpen(true)
  }

  const markAsRead = async (id: number) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
      setNotifications(notifications.map((n: any) => n.id === id ? { ...n, isRead: true } : n))
    } catch (error) {}
  }

  const clearNotification = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
      setNotifications(notifications.filter((n: any) => n.id !== id))
    } catch (error) {}
  }

  const clearAllNotifications = async () => {
    try {
      await fetch(`/api/notifications`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
      setNotifications([])
    } catch (error) {}
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !selectedFile) return alert("Please provide a title and select a file!")

    const formData = new FormData()
    formData.append("title", title)
    formData.append("category", category)
    formData.append("propertyId", propertyId)
    formData.append("description", description)
    formData.append("file", selectedFile)

    setUploading(true)
    try {
      const response = await fetch('/api/resources', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      })

      if (response.ok) {
        const newRes = await response.json()
        setResources([newRes, ...resources])
        setIsUploadOpen(false)
        setTitle("")
        setDescription("")
        setSelectedFile(null)
      } else {
        alert("Failed to upload resource.")
      }
    } catch (error) {
      alert("Network Error")
    } finally {
      setUploading(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editId || !editTitle) return alert("Title is required!")

    const formData = new FormData()
    formData.append("title", editTitle)
    formData.append("category", editCategory)
    formData.append("propertyId", editPropertyId)
    formData.append("description", editDescription)
    if (editFile) {
      formData.append("file", editFile)
    }

    setSavingEdit(true)
    try {
      const response = await fetch(`/api/resources/${editId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      })

      if (response.ok) {
        const updatedRes = await response.json()
        setResources(resources.map((r: any) => r.id === editId ? updatedRes : r))
        if (previewResource?.id === editId) {
          setPreviewResource(updatedRes)
        }
        setIsEditOpen(false)
      } else {
        alert("Failed to update resource.")
      }
    } catch (error) {
      alert("Network Error")
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this resource?")) return
    try {
      const response = await fetch(`/api/resources/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      if (response.ok) {
        setResources(resources.filter((r: any) => r.id !== id))
        if (previewResource?.id === id) setPreviewResource(null)
      }
    } catch (error) {
      alert("Failed to delete resource")
    }
  }

  const copyToClipboard = (url: string, id: number) => {
    const fullUrl = `${window.location.origin}${url}`
    navigator.clipboard.writeText(fullUrl)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const getPreviewType = (fileUrl: string): "image" | "pdf" | "other" => {
    if (!fileUrl) return "other"
    const ext = fileUrl.split('.').pop()?.toLowerCase() || ""
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) return "image"
    if (ext === 'pdf') return "pdf"
    return "other"
  }

  const getFileIcon = (fileUrl: string) => {
    if (!fileUrl) return { icon: File, color: "bg-slate-100 text-slate-600" }
    const ext = fileUrl.split('.').pop()?.toLowerCase()
    if (['pdf'].includes(ext || '')) return { icon: FileText, color: "bg-red-50 text-red-600 border-red-100" }
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext || '')) return { icon: ImageIcon, color: "bg-indigo-50 text-indigo-600 border-indigo-100" }
    if (['zip', 'rar', '7z', 'tar'].includes(ext || '')) return { icon: FileArchive, color: "bg-amber-50 text-amber-600 border-amber-100" }
    if (['xls', 'xlsx', 'csv'].includes(ext || '')) return { icon: FileSpreadsheet, color: "bg-emerald-50 text-emerald-600 border-emerald-100" }
    if (['js', 'ts', 'json', 'html', 'css'].includes(ext || '')) return { icon: FileCode, color: "bg-blue-50 text-blue-600 border-blue-100" }
    return { icon: File, color: "bg-slate-100 text-slate-600 border-slate-200" }
  }

  const categories = ["All", "SOPs", "Brand_Assets", "Manual", "Guide", "Software", "Forms"]

  const filteredResources = resources.filter((r: any) => {
    const matchesCategory = activeCategory === "All" || r.category === activeCategory;
    const matchesSearch = (r.title && r.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (r.fileName && r.fileName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const unreadCount = notifications.filter((n: any) => !n.isRead).length
  const canUpload = isAdmin;

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
                            {!n.isRead ? <span className="h-2 w-2 bg-blue-600 rounded-full mt-0.5"></span> : <Check className="w-3 h-3 text-emerald-500" />}
                            <button onClick={(e) => clearNotification(e, n.id)} className="p-1 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded transition-colors"><X className="w-3 h-3" /></button>
                          </div>
                        </div>
                        {n.description && <p className={`text-xs ${!n.isRead ? 'text-slate-700' : 'text-slate-500'} mb-2`}>{n.description}</p>}
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
        {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
        )}

        {/* RESPONSIVE SIDEBAR */}
        <aside className={`${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative z-50 w-64 h-[calc(100vh-4rem)] md:h-auto bg-slate-900 border-r border-slate-800 text-white p-6 flex flex-col transition-transform duration-300 ease-in-out`}>
          <div className="flex justify-between items-center md:hidden mb-6 pb-4 border-b border-slate-800">
            <span className="font-bold tracking-wider text-slate-300">MENU</span>
            <button className="text-slate-400 hover:text-white focus:outline-none" onClick={() => setIsMobileMenuOpen(false)}>
              <X className="w-6 h-6" />
            </button>
          </div>

          <nav className="space-y-4 overflow-y-auto flex-1">
            <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/dashboard') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300 transition-colors'}`}>Dashboard</Link>
            <Link to="/tickets" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/tickets') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300 transition-colors'}`}>Tickets</Link>
            <Link to="/projects" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/projects') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300 transition-colors'}`}>Projects</Link>
            <Link to="/checklists" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/checklists') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300 transition-colors'}`}>Routine Checklists</Link>
            <Link to="/resources" onClick={() => setIsMobileMenuOpen(false)} className={`block text-white font-medium`}>Resource Hub</Link>
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

          {canUpload && (
            <Button onClick={() => { setIsMobileMenuOpen(false); openUploadModal(); }} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold mt-6 shrink-0 rounded-xl shadow-lg shadow-indigo-900/20">
              <Upload className="w-4 h-4 mr-2" /> Upload Resource
            </Button>
          )}
        </aside>

        {/* MEDIA LIBRARY MAIN CONTENT */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden w-full flex">
          <div className="max-w-7xl mx-auto flex-1 flex flex-col">
            
            {/* HEADER & CONTROLS */}
            <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <FolderOpen className="w-7 h-7 text-indigo-600" /> Resource Hub & Media Library
                </h1>
                <p className="text-sm text-slate-500 mt-1">Access global corporate assets and property-specific SOPs.</p>
              </div>
              
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search documents..." 
                    className="pl-10 h-10 rounded-xl bg-white border-slate-200 focus-visible:ring-indigo-500 w-full max-w-none shadow-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="flex bg-slate-200/70 p-1 rounded-xl shrink-0">
                  <button 
                    onClick={() => setViewMode("grid")} 
                    className={`p-2 rounded-lg transition-colors ${viewMode === "grid" ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    title="Grid View"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setViewMode("list")} 
                    className={`p-2 rounded-lg transition-colors ${viewMode === "list" ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    title="List View"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>

                {canUpload && (
                  <Button onClick={openUploadModal} className="hidden md:flex bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-4 rounded-xl shadow-md">
                    <Upload className="w-4 h-4 mr-2" /> Upload
                  </Button>
                )}
              </div>
            </header>

            {/* CATEGORY PILL BAR */}
            <div className="flex overflow-x-auto whitespace-nowrap gap-2 mb-6 pb-2 [&::-webkit-scrollbar]:hidden">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                    activeCategory === cat 
                      ? 'bg-indigo-600 text-white shadow-indigo-600/20 shadow-md' 
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/60'
                  }`}
                >
                  {cat === "All" ? "All Resources" : cat.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* CONTENT AREA: GRID OR LIST */}
            {loading ? (
              <div className="py-20 text-center text-slate-400 text-sm">Loading media library...</div>
            ) : filteredResources.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center shadow-sm my-auto">
                <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">No resources found</h3>
                <p className="text-sm text-slate-500 mt-1">Try adjusting your search or upload a new file.</p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-8">
                {filteredResources.map((res: any) => {
                  const { icon: FileTypeIcon, color } = getFileIcon(res.fileUrl)
                  const previewType = getPreviewType(res.fileUrl)
                  return (
                    <Card 
                      key={res.id} 
                      onClick={() => setPreviewResource(res)}
                      className="cursor-pointer border border-slate-200/60 hover:border-indigo-500/50 transition-all rounded-2xl bg-white shadow-sm hover:shadow-xl group relative overflow-hidden flex flex-col justify-between"
                    >
                      {/* THUMBNAIL AREA */}
                      <div className="h-36 w-full bg-slate-100/80 border-b border-slate-100 flex items-center justify-center overflow-hidden relative">
                        {previewType === "image" ? (
                          <img 
                            src={res.fileUrl} 
                            alt={res.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                          />
                        ) : (
                          <div className={`p-4 rounded-2xl border ${color} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                            <FileTypeIcon className="w-8 h-8" />
                          </div>
                        )}
                        
                        {/* PROPERTY / GLOBAL SCOPE BADGE */}
                        <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase backdrop-blur-sm shadow-sm flex items-center gap-1 ${
                          res.property ? 'bg-indigo-600/90 text-white' : 'bg-slate-900/80 text-white'
                        }`}>
                          {res.property ? <Building2 className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                          {res.property ? res.property.code : 'Global'}
                        </span>

                        <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-white/90 backdrop-blur-sm text-slate-700 shadow-sm">
                          {res.category.replace('_', ' ')}
                        </span>
                      </div>

                      <CardContent className="p-4 flex flex-col justify-between flex-1">
                        <div>
                          <h3 className="font-bold text-slate-900 text-base mb-1 group-hover:text-indigo-600 transition-colors line-clamp-1">
                            {res.title}
                          </h3>
                          <p className="text-xs text-slate-500 line-clamp-2 mb-4">
                            {res.description || res.fileName}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-400">
                          <span>{new Date(res.createdAt).toLocaleDateString()}</span>
                          <span className="font-semibold text-indigo-600 group-hover:underline flex items-center">
                            Preview <Eye className="w-3 h-3 ml-1" />
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden mb-8">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-100 bg-slate-50/50">
                      <TableHead className="font-semibold text-slate-500 px-5 text-[11px] uppercase">Title</TableHead>
                      <TableHead className="font-semibold text-slate-500 px-5 text-[11px] uppercase">Scope</TableHead>
                      <TableHead className="font-semibold text-slate-500 px-5 text-[11px] uppercase">Category</TableHead>
                      <TableHead className="font-semibold text-slate-500 px-5 text-[11px] uppercase">File Name</TableHead>
                      <TableHead className="font-semibold text-slate-500 px-5 text-[11px] uppercase">Date Added</TableHead>
                      <TableHead className="font-semibold text-slate-500 px-5 text-[11px] uppercase text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResources.map((res: any) => {
                      const { icon: FileTypeIcon, color } = getFileIcon(res.fileUrl)
                      return (
                        <TableRow key={res.id} onClick={() => setPreviewResource(res)} className="border-b border-slate-50 hover:bg-slate-50/85 transition-colors cursor-pointer group">
                          <TableCell className="px-5 py-3 font-semibold text-slate-900 text-sm flex items-center gap-3">
                            <div className={`p-2 rounded-xl border ${color} shrink-0`}>
                              <FileTypeIcon className="w-4 h-4" />
                            </div>
                            <span className="group-hover:text-indigo-600 transition-colors">{res.title}</span>
                          </TableCell>
                          <TableCell className="px-5 py-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase inline-flex items-center gap-1 ${
                              res.property ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {res.property ? res.property.code : 'Global'}
                            </span>
                          </TableCell>
                          <TableCell className="px-5 py-3">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                              {res.category.replace('_', ' ')}
                            </span>
                          </TableCell>
                          <TableCell className="px-5 py-3 text-xs text-slate-500 truncate max-w-[200px]">{res.fileName}</TableCell>
                          <TableCell className="px-5 py-3 text-xs text-slate-500">{new Date(res.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell className="px-5 py-3 text-right">
                            <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              <a href={`${res.fileUrl}`} download target="_blank" rel="noreferrer" className="p-2 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors">
                                <Download className="w-4 h-4" />
                              </a>
                              {isAdmin && (
                                <>
                                  <button onClick={() => openEditModal(res)} className="p-2 hover:bg-amber-50 text-slate-400 hover:text-amber-600 rounded-lg transition-colors" title="Edit Resource">
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => handleDelete(res.id)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors" title="Delete Resource">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* LIVE MEDIA PREVIEW & DETAIL MODAL */}
      <Dialog open={!!previewResource} onOpenChange={(open) => !open && setPreviewResource(null)}>
        <DialogContent className="w-[95vw] max-w-[750px] max-h-[90vh] overflow-y-auto bg-white p-6 md:p-8 rounded-3xl border-none shadow-2xl">
          {previewResource && (
            <div className="space-y-5">
              <div className="flex justify-between items-start pr-6">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-2xl border ${getFileIcon(previewResource.fileUrl).color}`}>
                    {React.createElement(getFileIcon(previewResource.fileUrl).icon, { className: "w-6 h-6" })}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                        {previewResource.category.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                        {previewResource.property ? `${previewResource.property.name} (${previewResource.property.code})` : 'Global / All Properties'}
                      </span>
                    </div>
                    <DialogHeader>
                      <DialogTitle className="text-xl font-bold text-slate-900 mt-1 text-left">
                        {previewResource.title}
                      </DialogTitle>
                    </DialogHeader>
                  </div>
                </div>
              </div>

              {/* LIVE EMBEDDED MEDIA VIEWER */}
              <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-900/5 flex items-center justify-center">
                {getPreviewType(previewResource.fileUrl) === "image" ? (
                  <img 
                  src={`http://localhost:5000${previewResource.fileUrl}`} 
                  alt={previewResource.title} 
                  className="max-h-[55vh] w-auto object-contain mx-auto p-2" 
                  />
                ) : getPreviewType(previewResource.fileUrl) === "pdf" ? (
                <iframe 
                src={`http://localhost:5000${previewResource.fileUrl}`} 
                title={previewResource.title} 
                className="w-full h-[60vh] bg-white border-0" 
                />
              ) : (
                  <div className="py-12 px-6 text-center">
                    {React.createElement(getFileIcon(previewResource.fileUrl).icon, { className: "w-12 h-12 text-slate-400 mx-auto mb-3" })}
                    <p className="text-sm font-semibold text-slate-700">{previewResource.fileName}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Live browser preview is not available for this file format. Click Download below to view it.
                    </p>
                  </div>
                )}
              </div>

              {previewResource.description && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-slate-600 text-sm">
                  {previewResource.description}
                </div>
              )}

              <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                <div>
                  <span className="text-slate-400 font-medium mr-2">File Name:</span>
                  <span className="font-semibold text-slate-800 break-all">{previewResource.fileName}</span>
                </div>
                <div className="sm:text-right">
                  <span className="text-slate-400 font-medium mr-2">Added On:</span>
                  <span className="font-semibold text-slate-800">{new Date(previewResource.createdAt).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap gap-3 pt-1">
                <a 
                href={`http://localhost:5000${previewResource.fileUrl}`} 
                target="_blank" 
                rel="noreferrer"
                >
                  <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-11 rounded-2xl font-bold shadow-lg shadow-indigo-600/20">
                    <Download className="w-4 h-4 mr-2" /> Download
                  </Button>
                </a>

                <a 
                  href={previewResource.fileUrl} 
                  target="_blank" 
                  rel="noreferrer"
                >
                  <Button variant="outline" className="h-11 rounded-2xl border-slate-200 text-slate-700 font-semibold">
                    <ExternalLink className="w-4 h-4 mr-2" /> Open Tab
                  </Button>
                </a>

                <Button 
                  variant="outline" 
                  onClick={() => copyToClipboard(previewResource.fileUrl, previewResource.id)}
                  className="h-11 rounded-2xl border-slate-200 text-slate-700 font-semibold"
                >
                  {copiedId === previewResource.id ? <Check className="w-4 h-4 mr-2 text-emerald-600" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copiedId === previewResource.id ? "Copied!" : "Copy Link"}
                </Button>

                {isAdmin && (
                  <Button 
                    variant="outline" 
                    onClick={() => handleDelete(previewResource.id)} 
                    className="h-11 rounded-2xl border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* UPLOAD MODAL */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="w-[90vw] max-w-[450px] bg-white p-6 rounded-3xl border-none shadow-2xl">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-xl font-bold text-slate-900">Upload New Resource</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Document Title *</Label>
              <Input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full max-w-none h-10 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500" placeholder="e.g. WiFi Router Manual" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Category *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-full max-w-none h-10 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white rounded-xl shadow-xl border-slate-100">
                    <SelectItem value="SOPs">SOPs</SelectItem>
                    <SelectItem value="Brand_Assets">Brand Assets</SelectItem>
                    <SelectItem value="Manual">Manual</SelectItem>
                    <SelectItem value="Guide">Guide</SelectItem>
                    <SelectItem value="Software">Software</SelectItem>
                    <SelectItem value="Forms">Forms</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Property Scope</Label>
                <Select value={propertyId} onValueChange={setPropertyId}>
                  <SelectTrigger className="w-full max-w-none h-10 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white rounded-xl shadow-xl border-slate-100">
                    {userRole === 'Super_Admin' && (
                      <SelectItem value="Global" className="font-bold text-indigo-700">Global (All Hotels)</SelectItem>
                    )}
                    {allowedProperties.map((p: any) => (
                      <SelectItem key={p.id} value={p.id.toString()}>{p.name} ({p.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Description (Optional)</Label>
              <Textarea placeholder="Brief summary of this resource..." value={description} onChange={(e) => setDescription(e.target.value)} className="w-full max-w-none h-20 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 resize-none" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Select File *</Label>
              <div className="border-2 border-dashed border-slate-200 hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer bg-slate-50 transition-colors relative">
                <input 
                  type="file" 
                  required 
                  onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center">
                  <Plus className="w-8 h-8 text-slate-400 mb-2" />
                  <span className="text-sm font-semibold text-slate-700">
                    {selectedFile ? selectedFile.name : "Click to browse or drop file here"}
                  </span>
                  <span className="text-xs text-slate-400 mt-1">Supports PDF, DOCX, ZIP, Images</span>
                </div>
              </div>
            </div>

            <Button type="submit" disabled={uploading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white mt-4 h-11 rounded-xl shadow-lg shadow-indigo-600/20 font-bold tracking-wide">
              {uploading ? "Uploading..." : "Upload Document"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT RESOURCE MODAL */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="w-[90vw] max-w-[450px] bg-white p-6 rounded-3xl border-none shadow-2xl">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-xl font-bold text-slate-900">Edit Resource Details</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Document Title *</Label>
              <Input required value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full max-w-none h-10 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Category *</Label>
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger className="w-full max-w-none h-10 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white rounded-xl shadow-xl border-slate-100">
                    <SelectItem value="SOPs">SOPs</SelectItem>
                    <SelectItem value="Brand_Assets">Brand Assets</SelectItem>
                    <SelectItem value="Manual">Manual</SelectItem>
                    <SelectItem value="Guide">Guide</SelectItem>
                    <SelectItem value="Software">Software</SelectItem>
                    <SelectItem value="Forms">Forms</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Property Scope</Label>
                <Select value={editPropertyId} onValueChange={setEditPropertyId}>
                  <SelectTrigger className="w-full max-w-none h-10 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white rounded-xl shadow-xl border-slate-100">
                    {userRole === 'Super_Admin' && (
                      <SelectItem value="Global" className="font-bold text-indigo-700">Global (All Hotels)</SelectItem>
                    )}
                    {allowedProperties.map((p: any) => (
                      <SelectItem key={p.id} value={p.id.toString()}>{p.name} ({p.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Description (Optional)</Label>
              <Textarea placeholder="Brief summary of this resource..." value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="w-full max-w-none h-20 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 resize-none" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Replace File (Optional)</Label>
              <div className="border-2 border-dashed border-slate-200 hover:border-indigo-500 rounded-2xl p-4 text-center cursor-pointer bg-slate-50 transition-colors relative">
                <input 
                  type="file" 
                  onChange={(e) => e.target.files && setEditFile(e.target.files[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center">
                  <Upload className="w-6 h-6 text-slate-400 mb-1.5" />
                  <span className="text-xs font-semibold text-slate-700">
                    {editFile ? editFile.name : "Keep existing file (or click to replace)"}
                  </span>
                </div>
              </div>
            </div>

            <Button type="submit" disabled={savingEdit} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white mt-4 h-11 rounded-xl shadow-lg shadow-indigo-600/20 font-bold tracking-wide">
              {savingEdit ? "Saving Changes..." : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  )
}