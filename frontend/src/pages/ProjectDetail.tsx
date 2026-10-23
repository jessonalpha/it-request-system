import { useState, useRef, useEffect } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { Sparkles, Paperclip, Send, X, FileText, Trash2, Edit, CheckCircle, TrendingDown, TrendingUp, Download, Check, RotateCcw, Menu, Bell, LogOut, CheckCircle2, ArrowLeft, MessageSquare, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<"discussion" | "quotes">("discussion")
  
  const [users, setUsers] = useState<any[]>([]) 
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const userRole = localStorage.getItem('role') || 'User'
  const isAdmin = userRole === 'Admin' || userRole === 'Super_Admin'

  // --- Global State ---
  const [appSettings, setAppSettings] = useState({ companyName: "IT NextGen", logoUrl: "" })
  const [notifications, setNotifications] = useState<any[]>([])
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // --- User's Explicit Permissions ---
  const [myPermissions, setMyPermissions] = useState<Record<string, any>>({})

  // --- Edit Project State ---
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("") 
  const [editPriority, setEditPriority] = useState("")
  const [editBudget, setEditBudget] = useState("")
  const [editTargetDate, setEditTargetDate] = useState("")
  const [editPropertyId, setEditPropertyId] = useState("Global")
  const [editTaggedUserIds, setEditTaggedUserIds] = useState<string[]>([])

  // --- Discussion State ---
  const [newMessage, setNewMessage] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  // --- Quotes State ---
  const [isQuoteOpen, setIsQuoteOpen] = useState(false)
  const [editQuoteId, setEditQuoteId] = useState<number | null>(null)
  const [quoteVendor, setQuoteVendor] = useState("")
  const [quoteAmount, setQuoteAmount] = useState("")
  const [quoteDesc, setQuoteDesc] = useState("")
  const [isRevised, setIsRevised] = useState("false")
  const [quoteFile, setQuoteFile] = useState<File | null>(null)
  const quoteFileRef = useRef<HTMLInputElement>(null)

  const prevUnreadCount = useRef<number | null>(null)

  // --- Quote Comparison State ---
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false)
  const [comparisonData, setComparisonData] = useState<any>(null)
  const [isComparing, setIsComparing] = useState(false)
  const [compareDepth, setCompareDepth] = useState<"summary" | "full" | "audit">("full")
  const [customPrompt, setCustomPrompt] = useState("")

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

    fetch('/api/settings', { headers }).then(res => res.json()).then(data => setAppSettings(data))
    fetch('/api/users', { headers }).then(res => res.ok && res.json()).then(data => data && setUsers(data)).catch(() => {})
    fetch('/api/properties', { headers }).then(res => res.json()).then(data => setProperties(data))

    // Securely fetch permissions
    fetch('/api/users/me/permissions', { headers })
      .then(res => res.ok ? res.json() : { permissions: {} })
      .then(data => setMyPermissions(data.permissions || {}))
      .catch(() => setMyPermissions({}))

    const fetchProject = async () => {
      try {
        const response = await fetch(`/api/projects/${id}`, { headers })
        if (response.status === 401 || response.status === 403) return handleLogout()
        if (response.ok) setProject(await response.json())
        else navigate('/projects')
      } catch (error) {
        console.error("Failed to fetch project details")
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

    fetchProject()
    fetchNotifications()
    
    const intervalId = setInterval(fetchNotifications, 15000)
    return () => clearInterval(intervalId)
  }, [id, navigate])

  // Auto-scroll to bottom of comments
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [project?.comments])

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

  const handleStatusChange = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/projects/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ status: newStatus }),
      })
      if (response.ok) setProject({ ...project, status: newStatus, completedAt: newStatus === 'Completed' ? new Date() : null })
    } catch (error) { console.error("Failed to update status") }
  }

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      if (response.ok) navigate('/projects')
    } catch (error) { alert("Network Error while deleting") }
  }

  const openEditModal = () => {
    setEditTitle(project.title)
    setEditDescription(project.description || "") 
    setEditPriority(project.priority)
    setEditBudget(project.budget ? project.budget.toString() : "")
    setEditTargetDate(project.targetDate ? new Date(project.targetDate).toISOString().split('T')[0] : "")
    setEditPropertyId(project.propertyId ? project.propertyId.toString() : "Global")
    setEditTaggedUserIds(project.taggedUsers ? project.taggedUsers.map((tu: any) => tu.id.toString()) : [])
    setIsEditOpen(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ 
            title: editTitle, description: editDescription, priority: editPriority, 
            budget: editBudget || null, targetDate: editTargetDate || null, 
            propertyId: editPropertyId === "Global" ? null : editPropertyId,
            taggedUserIds: editTaggedUserIds
        }), 
      })
      if (response.ok) {
        setProject(await response.json())
        setIsEditOpen(false)
      }
    } catch (error) { alert("Network Error") }
  }

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() && !selectedFile) return
    const formData = new FormData()
    formData.append("message", newMessage)
    if (selectedFile) formData.append("document", selectedFile)

    try {
      const response = await fetch(`/api/projects/${id}/comments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      })
      if (response.ok) {
        const comment = await response.json()
        setProject({ ...project, comments: [...project.comments, comment] })
        setNewMessage(""); setSelectedFile(null)
      }
    } catch (error) { console.error("Failed to post comment") }
  }

  const openAddQuoteModal = () => {
    setEditQuoteId(null);
    setQuoteVendor(""); setQuoteAmount(""); setQuoteDesc(""); setIsRevised("false"); setQuoteFile(null);
    if (quoteFileRef.current) quoteFileRef.current.value = "";
    setIsQuoteOpen(true);
  };

  const openEditQuoteModal = (quote: any) => {
    setEditQuoteId(quote.id);
    setQuoteVendor(quote.vendorName);
    setQuoteAmount(quote.amount.toString());
    setQuoteDesc(quote.description || "");
    setIsRevised(quote.isRevised ? "true" : "false");
    setQuoteFile(null);
    if (quoteFileRef.current) quoteFileRef.current.value = "";
    setIsQuoteOpen(true);
  };

  const handleAddQuote = async (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData()
    formData.append("vendorName", quoteVendor)
    formData.append("amount", quoteAmount)
    formData.append("description", quoteDesc)
    formData.append("isRevised", isRevised)
    if (quoteFile) formData.append("document", quoteFile)

    try {
      const url = editQuoteId 
        ? `/api/projects/${id}/quotes/${editQuoteId}` 
        : `/api/projects/${id}/quotes`;
      const method = editQuoteId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      })
      if (response.ok) {
        const quote = await response.json()
        let updatedQuotes;
        if (editQuoteId) {
            updatedQuotes = project.quotes.map((q: any) => q.id === editQuoteId ? quote : q).sort((a: any, b: any) => a.amount - b.amount);
        } else {
            updatedQuotes = [...project.quotes, quote].sort((a: any, b: any) => a.amount - b.amount);
        }
        setProject({ ...project, quotes: updatedQuotes })
        setIsQuoteOpen(false)
      } else {
        const err = await response.json();
        alert(err.error || "Permission Denied or Failed to save quote.")
      }
    } catch (error) { alert("Failed to add quote") }
  }

  const handleDeleteQuote = async (quoteId: number) => {
    if (!window.confirm("Are you sure you want to delete this quote?")) return;
    try {
      const response = await fetch(`/api/projects/${id}/quotes/${quoteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      if (response.ok) {
        const updatedQuotes = project.quotes.filter((q: any) => q.id !== quoteId);
        setProject({ ...project, quotes: updatedQuotes });
      } else {
          const err = await response.json();
          alert(err.error || "Permission Denied.");
      }
    } catch (error) { alert("Network error deleting quote") }
  }

  const finalizeQuote = async (quoteId: number) => {
    try {
      const response = await fetch(`/api/projects/${id}/quotes/${quoteId}/finalize`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      if (response.ok) {
        const updatedQuotes = project.quotes.map((q: any) => ({ ...q, isFinalized: q.id === quoteId }))
        setProject({ ...project, quotes: updatedQuotes, status: 'Approved' })
      }
    } catch (error) { alert("Failed to finalize quote") }
  }

  const handleCompareQuotes = async () => {
    setIsComparing(true)
    try {
      const response = await fetch(`/api/projects/${id}/quotes/compare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          depth: compareDepth,
          customPrompt: customPrompt.trim()
        })
      })

      if (response.ok) {
        const data = await response.json()
        setComparisonData(data)
        setIsCompareModalOpen(true)
      } else {
        const err = await response.json()
        alert(err.error || "Failed to compare quotations.")
      }
    } catch (error) {
      alert("Network error while trying to compare quotations.")
    } finally {
      setIsComparing(false)
    }
  }

  const exportComparisonToExcel = () => {
    if (!comparisonData) return
    const workbook = XLSX.utils.book_new()

    const commercialRows = comparisonData.vendors?.map((v: any) => ({
      "Vendor": v.vendorName,
      "Total Price": v.totalQuoted,
      "Taxes / GST": v.taxes,
      "Delivery Timeline": v.deliveryTimeline,
      "Payment Terms": v.paymentTerms,
      "Warranty / SLA": v.warranty,
      "Key Advantages": (v.keyPros || []).join("; "),
      "Risks / Concerns": (v.keyCons || []).join("; ")
    })) || []
    const wsCommercial = XLSX.utils.json_to_sheet(commercialRows)
    XLSX.utils.book_append_sheet(workbook, wsCommercial, "Commercial Overview")

    if (comparisonData.itemizedMatrix && comparisonData.itemizedMatrix.length > 0) {
      const itemizedRows: any[] = []
      comparisonData.itemizedMatrix.forEach((item: any) => {
        const row: any = { "Item Description": item.itemDescription, "Quantity": item.quantity }
        item.vendorPrices?.forEach((vp: any) => {
          row[`${vp.vendorName} Model`] = vp.brandModel || "-"
          row[`${vp.vendorName} Unit Rate`] = vp.unitPrice || "-"
          row[`${vp.vendorName} Total`] = vp.totalPrice || "-"
        })
        itemizedRows.push(row)
      })
      const wsItemized = XLSX.utils.json_to_sheet(itemizedRows)
      XLSX.utils.book_append_sheet(workbook, wsItemized, "Itemized Comparison")
    }
    XLSX.writeFile(workbook, `Quote_Comparison_${project?.projectNum || id}.xlsx`)
  }

  const exportComparisonToPdf = () => {
    if (!comparisonData) return
    const doc = new jsPDF("landscape")
    let currentY = 15

    doc.setFont("helvetica", "bold")
    doc.setFontSize(16)
    doc.text(`Quotation Comparison Report - ${project?.title || 'Project'} (${project?.projectNum || ''})`, 14, currentY)
    currentY += 8

    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleDateString()} | Recommended: ${comparisonData.recommendedVendor || 'Under Evaluation'}`, 14, currentY)
    currentY += 8

    const commercialHead = [["Vendor", "Total", "Taxes", "Delivery", "Payment Terms", "Warranty"]]
    const commercialBody = comparisonData.vendors?.map((v: any) => [ v.vendorName, v.totalQuoted, v.taxes, v.deliveryTimeline, v.paymentTerms, v.warranty ]) || []

    autoTable(doc, { startY: currentY, head: commercialHead, body: commercialBody, headStyles: { fillColor: [30, 58, 138] }, styles: { fontSize: 8 } })
    currentY = (doc as any).lastAutoTable.finalY + 12

    if (comparisonData.itemizedMatrix && comparisonData.itemizedMatrix.length > 0) {
      if (currentY > 160) { doc.addPage(); currentY = 15; }

      doc.setFont("helvetica", "bold")
      doc.setFontSize(12)
      doc.text("Line-Item Breakdown", 14, currentY)
      currentY += 4

      const itemHead = ["Item / Specification", "Qty"]
      comparisonData.vendors?.forEach((v: any) => itemHead.push(`${v.vendorName} (Model & Total)`))

      const itemBody = comparisonData.itemizedMatrix.map((item: any) => {
        const row = [item.itemDescription, item.quantity]
        comparisonData.vendors?.forEach((v: any) => {
          const vp = item.vendorPrices?.find((p: any) => p.vendorName === v.vendorName)
          row.push(vp ? `${vp.brandModel || '-'} | ${vp.totalPrice || '-'}` : "Not Quoted")
        })
        return row
      })

      autoTable(doc, { startY: currentY, head: [itemHead], body: itemBody, headStyles: { fillColor: [15, 23, 42] }, styles: { fontSize: 8 } })
    }
    doc.save(`Quote_Comparison_${project?.projectNum || id}.pdf`)
  }

  const getDisplayName = (u: any) => {
    if (!u) return "Unknown User"
    if (u.firstName || u.lastName) return `${u.firstName || ''} ${u.lastName || ''}`.trim()
    return u.email?.split('@')[0] || "Unknown"
  }
  
  const exportProjectReport = () => {
    const doc = new jsPDF()
    const finalizedQuote = project.quotes?.find((q: any) => q.isFinalized)
    const propertyName = project.property?.name || 'Global HQ'
    let currentY = 20;

    doc.setFont("helvetica", "bold")
    doc.setFontSize(22)
    doc.setTextColor(40, 40, 40)
    doc.text(appSettings.companyName.toUpperCase(), 105, currentY, { align: "center" })
    currentY += 10
    
    doc.setFontSize(16)
    doc.setTextColor(60, 60, 60)
    doc.text(`${project.title} Project Report`, 105, currentY, { align: "center" })
    currentY += 8
    
    doc.setFontSize(12)
    doc.setFont("helvetica", "normal")
    doc.text(propertyName, 105, currentY, { align: "center" })
    currentY += 15

    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.text(`SUBMITTED BY: ${getDisplayName(project.user).toUpperCase()}`, 14, currentY)
    doc.text(`DATE: ${new Date().toLocaleDateString()}`, 150, currentY)
    currentY += 15

    doc.setFontSize(14)
    doc.setTextColor(30, 58, 138)
    doc.text("1. Project Overview", 14, currentY)
    currentY += 8
    
    doc.setFontSize(11)
    doc.setTextColor(40, 40, 40)
    doc.setFont("helvetica", "normal")
    doc.text(`Project title: ${project.title}`, 14, currentY); currentY += 6;
    doc.text(`Location: ${propertyName}`, 14, currentY); currentY += 6;
    doc.text(`Project ID: ${project.projectNum}`, 14, currentY); currentY += 6;
    
    doc.text(`Scope:`, 14, currentY); 
    const splitScope = doc.splitTextToSize(project.description || "N/A", 160);
    doc.text(splitScope, 30, currentY);
    currentY += (splitScope.length * 5) + 5;

    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.setTextColor(30, 58, 138)
    doc.text("2. Commercial Summary", 14, currentY)
    currentY += 8
    
    doc.setFontSize(11)
    doc.setTextColor(40, 40, 40)
    doc.setFont("helvetica", "normal")
    
    doc.text(`Estimated Budget: ${project.budget ? project.budget.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) : 'N/A'}`, 14, currentY); currentY += 6;
    
    if (finalizedQuote) {
      doc.text(`Finalized vendor: ${finalizedQuote.vendorName}`, 14, currentY); currentY += 6;
      doc.text(`Finalized quote value: ${finalizedQuote.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })} (inclusive of taxes)`, 14, currentY); currentY += 6;
      doc.text(`Purchase order (PO) issued: _________`, 14, currentY); currentY += 6;
      
      if (project.budget) {
        const savings = project.budget - finalizedQuote.amount
        doc.text(`Budget Variance: ${savings >= 0 ? '+' : ''}${savings.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })} (${savings >= 0 ? 'Savings' : 'Overrun'})`, 14, currentY); currentY += 6;
      }
    } else {
      doc.text(`Finalized vendor: Pending Final Approval`, 14, currentY); currentY += 6;
    }
    currentY += 5;

    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.setTextColor(30, 58, 138)
    doc.text("3. Implementation Timeline", 14, currentY)
    currentY += 8
    
    doc.setFontSize(11)
    doc.setTextColor(40, 40, 40)
    doc.setFont("helvetica", "normal")
    doc.text(`Work started: ${new Date(project.createdAt).toLocaleDateString()}`, 14, currentY); currentY += 6;
    doc.text(`Work completed: ${project.completedAt ? new Date(project.completedAt).toLocaleDateString() : 'Pending'}`, 14, currentY); currentY += 10;

    if (currentY > 230) { doc.addPage(); currentY = 20; }

    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.setTextColor(30, 58, 138)
    doc.text("4. Work Completed & Submitted Quotes", 14, currentY)
    currentY += 4

    autoTable(doc, {
      startY: currentY,
      head: [['Vendor', 'Amount', 'Revised', 'Status']],
      body: project.quotes?.map((q: any) => [
        q.vendorName,
        q.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }),
        q.isRevised ? 'Yes' : 'No',
        q.isFinalized ? 'Selected' : 'Rejected'
      ]),
      headStyles: { fillColor: [30, 58, 138] },
      margin: { left: 14 }
    })
    currentY = (doc as any).lastAutoTable.finalY + 15

    if (currentY > 200) { doc.addPage(); currentY = 20; }

    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.setTextColor(30, 58, 138)
    doc.text("5. Remarks / Pending Items", 14, currentY)
    currentY += 12
    
    doc.setDrawColor(200, 200, 200)
    doc.line(14, currentY, 196, currentY); currentY += 10;
    doc.line(14, currentY, 196, currentY); currentY += 10;
    doc.line(14, currentY, 196, currentY); currentY += 20;

    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.setTextColor(30, 58, 138)
    doc.text("6. Sign-Off", 14, currentY)
    currentY += 15

    doc.setFontSize(11)
    doc.setTextColor(40, 40, 40)
    
    doc.text("Date: ____________________", 14, currentY)
    currentY += 25

    doc.text("_________________________", 14, currentY)
    doc.text("_________________________", 80, currentY)
    doc.text("_________________________", 146, currentY)
    currentY += 6
    
    doc.setFont("helvetica", "bold")
    doc.text("IT Manager", 25, currentY)
    doc.text("General Manager", 90, currentY)
    doc.text("Corp. IT Manager", 155, currentY)

    doc.save(`Project_${project.projectNum}_Report.pdf`)
  }

  // --- COMPONENT PERMISSION CHECKS ---
  const canAddQuote = isAdmin || !!myPermissions.add_quotes;
  const canEditQuote = isAdmin || !!myPermissions.edit_quotes;
  const canDeleteQuote = isAdmin || !!myPermissions.delete_quotes;

  const unreadCount = notifications.filter(n => !n.isRead).length

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-100 text-slate-500">Loading project details...</div>
  if (!project) return <div className="flex h-screen items-center justify-center bg-slate-100 text-slate-500">Project not found or access denied.</div>

  const finalizedQuote = project.quotes?.find((q: any) => q.isFinalized)
  const budgetDelta = project.budget && finalizedQuote ? project.budget - finalizedQuote.amount : null
  const isCompleted = project.status === "Completed"
  
  const pipeline = ["Scoping", "Quoting", "Approved", "Execution", "Completed"]
  const currentStageIndex = pipeline.indexOf(project.status)

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      
      {/* TOP RIBBON */}
      <header className="h-16 bg-slate-900 text-white flex items-center justify-between px-4 md:px-6 shrink-0 shadow-md relative z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 text-slate-300 hover:text-white focus:outline-none">
            <Menu className="w-6 h-6" />
          </button>
          {appSettings.logoUrl && <img src={`${appSettings.logoUrl}`} alt="Logo" className="h-8 md:h-10 w-auto bg-white/10 rounded p-1 object-contain hidden sm:block" />}
          <h1 className="text-lg md:text-xl font-bold tracking-tight truncate max-w-[140px] md:max-w-none">{appSettings.companyName}</h1>
        </div>
        <div className="flex items-center gap-2 md:gap-6">
          <div className="relative">
            <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="relative p-2 hover:bg-slate-800 rounded-full transition-colors focus:outline-none">
              <Bell className="w-5 h-5 text-slate-300" />
              {unreadCount > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center border-2 border-slate-900">{unreadCount}</span>}
            </button>
            {isNotifOpen && (
              <div className="absolute right-[-40px] md:right-0 mt-3 w-[300px] md:w-80 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden text-slate-800 z-50">
                <div className="p-3 md:p-4 bg-slate-50 border-b border-slate-100 font-semibold flex justify-between items-center">
                  <span className="text-sm md:text-base">Notifications <span className="text-xs font-normal text-slate-500 ml-1">({unreadCount})</span></span>
                  {notifications.length > 0 && <button onClick={clearAllNotifications} className="text-[10px] text-red-600 hover:text-red-800 font-bold uppercase tracking-wider">Clear All</button>}
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
        {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />}
        <aside className={`${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative z-50 w-64 h-[calc(100vh-4rem)] md:h-auto bg-slate-800 text-white p-6 flex flex-col transition-transform duration-300 ease-in-out`}>
          <div className="flex justify-between items-center md:hidden mb-6 pb-4 border-b border-slate-700">
            <span className="font-bold tracking-wider text-slate-300">MENU</span>
            <button className="text-slate-400 hover:text-white focus:outline-none" onClick={() => setIsMobileMenuOpen(false)}><X className="w-6 h-6" /></button>
          </div>
          <nav className="space-y-4 overflow-y-auto flex-1">
            <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/dashboard') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300'}`}>Dashboard</Link>
            <Link to="/tickets" onClick={() => setIsMobileMenuOpen(false)} className={`block ${window.location.pathname.includes('/tickets') ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-300'}`}>Tickets</Link>
            <Link to="/projects" onClick={() => setIsMobileMenuOpen(false)} className={`block text-white font-medium`}>Projects</Link>
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
            {userRole === 'Super_Admin' && <Link to="/settings" onClick={() => setIsMobileMenuOpen(false)} className={`block mt-6 pt-4 border-t border-slate-700 ${window.location.pathname.includes('/settings') ? 'text-amber-400 font-bold' : 'text-amber-500 font-medium hover:text-amber-400'}`}>Super Admin Console</Link>}
            <button onClick={handleLogout} className="md:hidden flex items-center text-red-400 hover:text-red-300 mt-6 pt-4 border-t border-slate-700 w-full text-left font-medium"><LogOut className="w-4 h-4 mr-2" /> Sign Out</button>
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden w-full">
          <div className="max-w-5xl mx-auto space-y-6">
            
            <div>
              <button onClick={() => navigate('/projects')} className="flex items-center text-xs md:text-sm text-slate-500 hover:text-indigo-600 mb-4 transition-colors font-medium">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Portfolio
              </button>
              
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl md:text-3xl font-bold text-slate-900 leading-tight">
                    {project.title}
                    <span className={`ml-3 align-middle px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider ${project.priority === 'High' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{project.priority}</span>
                  </h1>
                  <p className="text-xs md:text-sm text-slate-500 mt-1">{project.projectNum} • Drafted by {getDisplayName(project.user)} • {project.property?.name || 'Global HQ'}</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={exportProjectReport} className="h-9 text-slate-700 border-slate-300 text-xs md:text-sm">
                    <Download className="w-4 h-4 mr-1 md:mr-2" /> <span className="hidden sm:inline">Export Report</span><span className="sm:hidden">Export</span>
                  </Button>
                  
                  {isAdmin && !isCompleted && (
                    <Button size="sm" onClick={() => handleStatusChange('Completed')} className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-xs md:text-sm">
                      <CheckCircle className="w-4 h-4 mr-1 md:mr-2" /> <span className="hidden sm:inline">Mark Completed</span><span className="sm:hidden">Complete</span>
                    </Button>
                  )}
                  {userRole === 'Super_Admin' && isCompleted && (
                    <Button size="sm" onClick={() => handleStatusChange('Execution')} className="h-9 bg-amber-600 hover:bg-amber-700 text-white text-xs md:text-sm">
                      <RotateCcw className="w-4 h-4 mr-1 md:mr-2" /> <span className="hidden sm:inline">Reopen Project</span><span className="sm:hidden">Reopen</span>
                    </Button>
                  )}
                  {isAdmin && (
                    <>
                      <Button variant="outline" size="icon" onClick={openEditModal} className="h-9 w-9 text-indigo-600 hover:text-indigo-800 border-slate-300 ml-1">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="icon" className="h-9 w-9 text-red-600 hover:text-red-800 border-slate-300"><Trash2 className="w-4 h-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="w-[90vw] max-w-[400px] bg-white rounded-xl">
                          <AlertDialogHeader><AlertDialogTitle>Delete Project?</AlertDialogTitle><AlertDialogDescription className="text-xs md:text-sm">This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter className="mt-4">
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={handleDelete}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              
              <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                <div className="min-w-[500px] relative px-2">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 rounded-full z-0"></div>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-indigo-600 rounded-full z-0 transition-all duration-500" style={{ width: `${(currentStageIndex / (pipeline.length - 1)) * 100}%` }}></div>
                  
                  <div className="flex items-center justify-between">
                    {pipeline.map((stage, idx) => {
                      const isPassed = idx <= currentStageIndex
                      return (
                        <div key={stage} className="relative z-10 flex flex-col items-center gap-2 bg-slate-50 px-2">
                          <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[10px] md:text-xs font-bold transition-colors ${isPassed ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' : 'bg-slate-200 text-slate-500'}`}>
                            {isPassed ? <Check className="w-3 h-3" /> : idx + 1}
                          </div>
                          <span className={`text-[9px] md:text-[10px] uppercase tracking-wider font-bold ${isPassed ? 'text-indigo-900' : 'text-slate-400'}`}>{stage}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 border-b border-slate-100 bg-white">
                <div className="p-4">
                  <p className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Estimated Budget</p>
                  <p className="text-lg md:text-xl font-bold text-slate-900">{project.budget ? project.budget.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }) : 'TBD'}</p>
                </div>
                <div className="p-4">
                  <p className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Target Date</p>
                  <p className={`text-lg md:text-xl font-bold ${project.targetDate && new Date(project.targetDate) < new Date() && !isCompleted ? 'text-red-600' : 'text-slate-900'}`}>
                    {project.targetDate ? new Date(project.targetDate).toLocaleDateString() : 'Unscheduled'}
                  </p>
                </div>
                <div className="p-4 bg-slate-50/50">
                  <p className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Budget Variance</p>
                  {budgetDelta !== null ? (
                    <div className={`flex items-center gap-1.5 md:gap-2 text-lg md:text-xl font-bold ${budgetDelta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {budgetDelta >= 0 ? <TrendingDown className="w-4 h-4 md:w-5 md:h-5" /> : <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />}
                      {Math.abs(budgetDelta).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                      <span className="text-[10px] md:text-xs font-semibold text-slate-500">{budgetDelta >= 0 ? 'Savings' : 'Overrun'}</span>
                    </div>
                  ) : (
                    <p className="text-sm md:text-lg font-medium text-slate-400">Pending Final Quote</p>
                  )}
                </div>
              </div>

              <div className="flex border-b border-slate-200 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                <button onClick={() => setActiveTab("discussion")} className={`flex-1 py-3 px-4 text-xs md:text-sm font-bold transition-colors whitespace-nowrap ${activeTab === "discussion" ? 'bg-white text-indigo-700 border-b-2 border-indigo-600' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>Project Scope & Discussion</button>
                <button onClick={() => setActiveTab("quotes")} className={`flex-1 py-3 px-4 text-xs md:text-sm font-bold transition-colors whitespace-nowrap ${activeTab === "quotes" ? 'bg-white text-indigo-700 border-b-2 border-indigo-600' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>Quotes & Vendors ({project.quotes?.length || 0})</button>
              </div>

              {activeTab === "discussion" && (
                <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                  <div className="flex-1 p-4 md:p-6 bg-white">
                    <h3 className="text-[10px] md:text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Project Scope</h3>
                    <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {project.description}
                    </div>
                  </div>
                  
                  <div className="w-full lg:w-[450px] shrink-0 flex flex-col h-[500px] lg:h-[600px] bg-slate-50/50">
                    <div className="p-3 md:p-4 border-b border-slate-100 bg-slate-50 shrink-0">
                      <h3 className="text-sm font-bold flex items-center gap-2 text-slate-800">
                        <MessageSquare className="w-4 h-4 text-indigo-500" /> Discussion Thread
                      </h3>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {project.comments?.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                          <MessageSquare className="w-8 h-8 opacity-20" />
                          <p className="text-xs">No updates yet.</p>
                        </div>
                      ) : (
                        project.comments?.map((comment: any) => {
                          const isMe = comment.user?.email === localStorage.getItem('email') || comment.user?.id?.toString() === localStorage.getItem('userId')
                          return (
                            <div key={comment.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                              <span className="text-[9px] md:text-[10px] font-semibold text-slate-400 mb-1 px-1">
                                {getDisplayName(comment.user)} • {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              
                              <div className={`px-3 md:px-4 py-2 md:py-2.5 rounded-2xl max-w-[85%] text-xs md:text-sm shadow-sm flex flex-col gap-2 ${
                                isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'
                              }`}>
                                {comment.message && <span className="whitespace-pre-wrap leading-relaxed">{comment.message}</span>}
                                
                                {comment.fileUrl && (
                                  <a href={`${comment.fileUrl}`} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                                      isMe ? 'bg-indigo-700 hover:bg-indigo-800 text-white' : 'bg-slate-100 hover:bg-slate-200 text-indigo-700'
                                  }`}>
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

                    <div className="p-3 md:p-4 bg-white border-t border-slate-100 shrink-0">
                      {selectedFile && (
                        <div className="flex items-center gap-2 mb-3 p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-xs font-semibold text-indigo-700 w-full">
                          <FileText className="w-4 h-4 shrink-0" />
                          <span className="truncate flex-1">{selectedFile.name}</span>
                          <button onClick={() => setSelectedFile(null)} className="hover:bg-indigo-100 p-1 rounded transition-colors shrink-0"><X className="w-3 h-3" /></button>
                        </div>
                      )}
                      
                      <form onSubmit={handlePostComment} className="flex gap-2 relative">
                        <input type="file" className="hidden" ref={fileInputRef} onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)} />
                        
                        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="h-[44px] w-[44px] shrink-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border-slate-200 p-0 rounded-xl">
                          <Paperclip className="w-5 h-5" />
                        </Button>
                        
                        <Textarea 
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Type an update..."
                          className="min-h-[44px] h-[44px] max-h-[120px] resize-none text-sm py-3 rounded-xl border-slate-200 focus-visible:ring-indigo-500 pr-12"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostComment(e); }
                          }}
                        />
                        
                        <Button type="submit" disabled={!newMessage.trim() && !selectedFile} className="absolute right-1 bottom-1 h-[36px] w-[36px] bg-indigo-600 hover:bg-indigo-700 text-white p-0 flex items-center justify-center rounded-lg transition-all disabled:opacity-50 disabled:bg-slate-300">
                          <Send className="w-4 h-4 ml-0.5" />
                        </Button>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "quotes" && (
                <div className="p-4 md:p-6 bg-slate-50/50 min-h-[400px]">
                  
                  <div className="bg-white p-4 rounded-xl border border-slate-200 mb-6 shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                      <div>
                        <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-amber-500" /> AI Quotation Comparison & PDF Reader
                        </h3>
                        <p className="text-xs text-slate-500">Extracts line items, pricing, and business terms across all vendor PDF quotes.</p>
                      </div>

                      <div className="flex items-center gap-2">
                        {canAddQuote && !isCompleted && (
                          <Button onClick={openAddQuoteModal} className="bg-slate-900 hover:bg-slate-800 text-white text-xs h-9">
                            + Add Quote
                          </Button>
                        )}
                        <Button 
                          onClick={handleCompareQuotes} 
                          disabled={isComparing || (project.quotes && project.quotes.length < 2)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 font-semibold shrink-0"
                        >
                          {isComparing ? "Analyzing Quotations..." : "Run AI Comparison"}
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-slate-500 font-semibold uppercase">Comparison Depth</Label>
                        <Select value={compareDepth} onValueChange={(val: any) => setCompareDepth(val)}>
                          <SelectTrigger className="h-9 bg-slate-50 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="summary">Commercial Summary (High-Level)</SelectItem>
                            <SelectItem value="full">Full Line-Item Matrix (All Items)</SelectItem>
                            <SelectItem value="audit">Deep Technical & Risk Audit</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-2 space-y-1">
                        <Label className="text-[11px] text-slate-500 font-semibold uppercase">Custom Audit Prompt / Instructions (Optional)</Label>
                        <Input 
                          placeholder="e.g., Verify if GST is extra, compare switch port capacity, highlight warranty differences..." 
                          value={customPrompt} 
                          onChange={(e) => setCustomPrompt(e.target.value)} 
                          className="h-9 text-xs bg-slate-50"
                        />
                      </div>
                    </div>
                  </div>

                  {project.quotes?.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">No quotes submitted yet.</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {project.quotes?.map((quote: any) => (
                        <div key={quote.id} className={`p-4 rounded-xl border-2 transition-all flex flex-col ${quote.isFinalized ? 'border-emerald-500 bg-emerald-50 shadow-md ring-4 ring-emerald-500/10' : 'border-slate-200 bg-white hover:border-indigo-300'}`}>
                          
                          <div className="flex justify-between items-start gap-4 mb-4">
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <h4 className="text-base md:text-lg font-bold text-slate-900 truncate max-w-[150px] sm:max-w-none">{quote.vendorName}</h4>
                                {quote.isRevised && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 uppercase tracking-wider shrink-0">Revised</span>}
                              </div>
                              <p className="text-xs md:text-sm text-slate-500 line-clamp-2">{quote.description}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-xl md:text-2xl font-bold ${quote.isFinalized ? 'text-emerald-700' : 'text-slate-900'}`}>{quote.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}</p>
                              <p className="text-[10px] md:text-xs text-slate-400 mt-1">By {getDisplayName(quote.uploadedBy)}</p>
                            </div>
                          </div>
                          
                          {quote.isFinalized && (
                            <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white uppercase tracking-wider w-fit">
                              <CheckCircle className="w-3.5 h-3.5" /> Finalized Winner
                            </div>
                          )}
                          
                          <div className="mt-auto pt-4 border-t border-slate-200/60 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                            {quote.fileUrl ? (
                              <a href={`${quote.fileUrl}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center sm:justify-start gap-2 text-xs md:text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 sm:bg-transparent p-2 sm:p-0 rounded-md">
                                <FileText className="w-4 h-4" /> View PDF
                              </a>
                            ) : <div className="hidden sm:block"></div>}

                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0 justify-end">
                              {/* Edit & Delete Buttons Explicitly Included */}
                              {canEditQuote && !quote.isFinalized && !isCompleted && (
                                <Button variant="outline" size="icon" onClick={() => openEditQuoteModal(quote)} className="h-8 w-8 text-indigo-600 hover:text-indigo-800 border-indigo-200 hover:bg-indigo-50">
                                  <Edit className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              
                              {canDeleteQuote && !quote.isFinalized && !isCompleted && (
                                <Button variant="outline" size="icon" onClick={() => handleDeleteQuote(quote.id)} className="h-8 w-8 text-red-600 hover:text-red-800 border-red-200 hover:bg-red-50">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}

                              {isAdmin && !quote.isFinalized && !isCompleted && (
                                <Button variant="outline" size="sm" onClick={() => finalizeQuote(quote.id)} className="h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                                  Mark Final
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ADD/EDIT QUOTE MODAL */}
      <Dialog open={isQuoteOpen} onOpenChange={setIsQuoteOpen}>
        <DialogContent className="w-[90vw] max-w-[425px] bg-white p-4 md:p-6 rounded-xl">
          <DialogHeader><DialogTitle>{editQuoteId ? "Edit Vendor Quote" : "Add Vendor Quote"}</DialogTitle></DialogHeader>
          <form onSubmit={handleAddQuote} className="space-y-4 mt-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-2"><Label>Vendor Name *</Label><Input required value={quoteVendor} onChange={(e) => setQuoteVendor(e.target.value)} /></div>
            <div className="space-y-2"><Label>Total Amount (₹) *</Label><Input type="number" required value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)} /></div>
            <div className="space-y-2"><Label>Details / Notes</Label><Textarea value={quoteDesc} onChange={(e) => setQuoteDesc(e.target.value)} className="h-20" /></div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Revised Quote?</Label>
                <Select value={isRevised} onValueChange={setIsRevised}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="false">No (Initial)</SelectItem>
                    <SelectItem value="true">Yes (Revised)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Attach PDF {editQuoteId && "(Optional)"}</Label>
                <input type="file" ref={quoteFileRef} className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 w-full" onChange={(e) => setQuoteFile(e.target.files ? e.target.files[0] : null)} />
              </div>
            </div>
            
            <Button type="submit" className="w-full bg-indigo-600 text-white hover:bg-indigo-700 mt-2">{editQuoteId ? "Update Quote" : "Upload Quote"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT PROJECT MODAL */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="w-[90vw] max-w-[425px] bg-white p-4 md:p-6 rounded-xl">
          <DialogHeader><DialogTitle>Edit Project Scope</DialogTitle><DialogDescription className="text-xs md:text-sm">Update the metadata or timeframe of this project.</DialogDescription></DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 mt-2 md:mt-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-2"><Label>Title *</Label><Input required value={editTitle} onChange={(e) => setEditTitle(e.target.value)} /></div>
            <div className="space-y-2"><Label>Scope / Description *</Label><Textarea required className="h-24" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} /></div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Property / Hotel</Label>
                <Select value={editPropertyId} onValueChange={setEditPropertyId}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="Global">Global / Corporate</SelectItem>
                    {properties.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Priority *</Label>
                <Select required value={editPriority} onValueChange={setEditPriority}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="Low">Low</SelectItem><SelectItem value="Medium">Medium</SelectItem><SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Est. Budget (₹)</Label><Input type="number" value={editBudget} onChange={(e) => setEditBudget(e.target.value)} /></div>
              <div className="space-y-2"><Label>Target Date</Label><Input type="date" value={editTargetDate} onChange={(e) => setEditTargetDate(e.target.value)} /></div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <Label>Modify Stakeholders</Label>
              <Select onValueChange={(val) => {
                if (!editTaggedUserIds.includes(val)) setEditTaggedUserIds([...editTaggedUserIds, val])
              }}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Add stakeholders..." /></SelectTrigger>
                <SelectContent className="bg-white">
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id.toString()}>
                      {getDisplayName(u)} {u.property ? `(${u.property.code})` : '(Global)'}
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
                        @{getDisplayName(u)} <X className="w-3 h-3 ml-1 cursor-pointer hover:text-red-500" onClick={() => setEditTaggedUserIds(editTaggedUserIds.filter(x => x !== id))} />
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white mt-2 md:mt-4">Save Changes</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* FULL AI QUOTATION COMPARISON & DOWNLOAD MODAL */}
      <Dialog open={isCompareModalOpen} onOpenChange={setIsCompareModalOpen}>
        <DialogContent className="w-[95vw] max-w-[1250px] bg-white p-4 md:p-6 rounded-xl max-h-[92vh] flex flex-col">
          <DialogHeader className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <div>
              <DialogTitle className="text-xl flex items-center gap-2 text-slate-900">
                <Sparkles className="w-5 h-5 text-amber-500" /> Quotation Comparison Matrix
              </DialogTitle>
              <DialogDescription className="text-xs md:text-sm mt-0.5">
                AI extracted all line-items and contract terms from the uploaded vendor PDFs.
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={exportComparisonToExcel} className="h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-semibold">
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> Download Excel (.xlsx)
              </Button>
              <Button variant="outline" size="sm" onClick={exportComparisonToPdf} className="h-8 text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-semibold">
                <Download className="w-3.5 h-3.5 mr-1.5" /> Download PDF (.pdf)
              </Button>
            </div>
          </DialogHeader>

          {comparisonData && (
            <div className="flex-1 overflow-y-auto space-y-6 mt-4 pr-1">
              
              {comparisonData.recommendedVendor && (
                <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs md:text-sm text-indigo-900 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                  <div><span className="font-bold">Recommendation:</span> {comparisonData.recommendedVendor}</div>
                </div>
              )}

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 font-bold text-xs uppercase tracking-wider text-slate-700">1. Commercial & Operational Terms</div>
                <div className="overflow-x-auto">
                  <Table className="min-w-[700px]">
                    <TableHeader className="bg-slate-50/50">
                      <TableRow>
                        <TableHead className="w-[180px] font-bold text-slate-700">Terms / Parameter</TableHead>
                        {comparisonData.vendors?.map((v: any, idx: number) => (
                          <TableHead key={idx} className="border-l border-slate-200 font-bold text-slate-900 min-w-[200px]">
                            <div>{v.vendorName}</div>
                            <div className="text-indigo-600 text-sm font-black mt-0.5">{v.totalQuoted}</div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      <TableRow>
                        <TableCell className="font-semibold text-slate-600 bg-slate-50/30">Taxes / GST</TableCell>
                        {comparisonData.vendors?.map((v: any, idx: number) => <TableCell key={idx} className="border-l border-slate-200">{v.taxes || "-"}</TableCell>)}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-semibold text-slate-600 bg-slate-50/30">Delivery Lead Time</TableCell>
                        {comparisonData.vendors?.map((v: any, idx: number) => <TableCell key={idx} className="border-l border-slate-200">{v.deliveryTimeline || "-"}</TableCell>)}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-semibold text-slate-600 bg-slate-50/30">Payment Terms</TableCell>
                        {comparisonData.vendors?.map((v: any, idx: number) => <TableCell key={idx} className="border-l border-slate-200">{v.paymentTerms || "-"}</TableCell>)}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-semibold text-slate-600 bg-slate-50/30">Warranty & SLA</TableCell>
                        {comparisonData.vendors?.map((v: any, idx: number) => <TableCell key={idx} className="border-l border-slate-200">{v.warranty || "-"}</TableCell>)}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-semibold text-emerald-700 bg-emerald-50/30 align-top">Key Advantages</TableCell>
                        {comparisonData.vendors?.map((v: any, idx: number) => (
                          <TableCell key={idx} className="border-l border-slate-200 align-top">
                            <ul className="list-disc list-inside space-y-1 text-slate-700">
                              {v.keyPros?.map((pro: string, i: number) => <li key={i}>{pro}</li>)}
                            </ul>
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-semibold text-red-700 bg-red-50/30 align-top">Risks / Exclusions</TableCell>
                        {comparisonData.vendors?.map((v: any, idx: number) => (
                          <TableCell key={idx} className="border-l border-slate-200 align-top">
                            <ul className="list-disc list-inside space-y-1 text-slate-700">
                              {v.keyCons?.map((con: string, i: number) => <li key={i}>{con}</li>)}
                            </ul>
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {comparisonData.itemizedMatrix && comparisonData.itemizedMatrix.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 font-bold text-xs uppercase tracking-wider text-slate-700">2. Itemized Line-by-Line Breakdown</div>
                  <div className="overflow-x-auto">
                    <Table className="min-w-[850px]">
                      <TableHeader className="bg-slate-50/50">
                        <TableRow>
                          <TableHead className="w-[280px] font-bold text-slate-700">Item / Scope Description</TableHead>
                          <TableHead className="w-[90px] font-bold text-slate-700">Qty</TableHead>
                          {comparisonData.vendors?.map((v: any, idx: number) => (
                            <TableHead key={idx} className="border-l border-slate-200 font-bold text-slate-900 min-w-[220px]">
                              {v.vendorName}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        {comparisonData.itemizedMatrix.map((item: any, rowIdx: number) => (
                          <TableRow key={rowIdx}>
                            <TableCell className="font-medium text-slate-800">{item.itemDescription}</TableCell>
                            <TableCell className="text-slate-500 font-semibold">{item.quantity}</TableCell>
                            {comparisonData.vendors?.map((v: any, vIdx: number) => {
                              const quoteDetail = item.vendorPrices?.find((vp: any) => vp.vendorName.toLowerCase() === v.vendorName.toLowerCase())
                              return (
                                <TableCell key={vIdx} className="border-l border-slate-200">
                                  {quoteDetail ? (
                                    <div>
                                      <div className="font-bold text-slate-900">{quoteDetail.totalPrice}</div>
                                      <div className="text-[10px] text-slate-500">Unit: {quoteDetail.unitPrice}</div>
                                      {quoteDetail.brandModel && (
                                        <div className="text-[10px] text-indigo-600 font-medium truncate max-w-[200px]">
                                          Model: {quoteDetail.brandModel}
                                        </div>
                                      )}
                                    </div>
                                  ) : <span className="text-slate-400 italic">Item Not Specified</span>}
                                </TableCell>
                              )
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {comparisonData.observations && comparisonData.observations.length > 0 && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider mb-2">Key Observations & Deviations</h4>
                  <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
                    {comparisonData.observations.map((obs: string, idx: number) => <li key={idx}>{obs}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
