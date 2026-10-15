import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router'
import './index.css'
import { Shell } from './components/Layout'
import { RequireAuth } from './components/RequireAuth'
import { LoginPage } from './pages/LoginPage'
import { Home } from './pages/Home'
import { FlowPage } from './pages/FlowPage'
import { GuidePage } from './pages/GuidePage'
import { ChecklistPage } from './pages/ChecklistPage'
import { FormsPage } from './pages/FormsPage'
import { ContactsHub } from './pages/ContactsHub'
import { InternalContacts, InternalSite } from './pages/InternalContacts'
import { ExternalContacts } from './pages/ExternalContacts'
import { CustomersPage } from './pages/CustomersPage'
import { ConstituentsPage } from './pages/ConstituentsPage'
import { WarRoomsPage } from './pages/WarRoomsPage'
import { IncidentList } from './pages/incidents/IncidentList'
import { IncidentRoom } from './pages/incidents/IncidentRoom'
import { AdminLayout } from './pages/admin/AdminLayout'
import { IncidentsAdmin } from './pages/admin/IncidentsAdmin'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { EntityAdmin } from './pages/admin/EntityAdmin'
import { ContentAdmin, ContentEditor } from './pages/admin/ContentAdmin'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, gcTime: 24 * 60 * 60_000, retry: 1 },
  },
})

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <Shell />,
        children: [
          { path: '/', element: <Home /> },
          { path: '/flow', element: <FlowPage /> },
          { path: '/guides/:slug', element: <GuidePage /> },
          { path: '/checklist', element: <ChecklistPage /> },
          { path: '/forms', element: <FormsPage /> },
          { path: '/contacts', element: <ContactsHub /> },
          { path: '/contacts/internal', element: <InternalContacts /> },
          { path: '/contacts/internal/:siteId', element: <InternalSite /> },
          { path: '/contacts/external', element: <ExternalContacts /> },
          { path: '/contacts/customers', element: <CustomersPage /> },
          { path: '/contacts/constituents', element: <ConstituentsPage /> },
          { path: '/contacts/war-rooms', element: <WarRoomsPage /> },
          { path: '/incidents', element: <IncidentList /> },
          { path: '/incidents/:id', element: <IncidentRoom /> },
        ],
      },
    ],
  },
  {
    element: <RequireAuth admin />,
    children: [
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminDashboard /> },
          { path: 'incidents', element: <IncidentsAdmin /> },
          { path: 'content', element: <ContentAdmin /> },
          { path: 'content/:slug', element: <ContentEditor /> },
          { path: ':entity', element: <EntityAdmin /> },
        ],
      },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
