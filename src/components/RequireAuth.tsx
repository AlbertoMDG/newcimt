import { Navigate, Outlet, useLocation } from 'react-router'
import { useMe } from '../api/client'
import { Loading } from './ui'

/** Layout route: renders children only with a valid session (and admin flag if required). */
export function RequireAuth({ admin = false }: { admin?: boolean }) {
  const { data: me, isPending, isError } = useMe()
  const location = useLocation()

  if (isPending) return <Loading />
  if (isError || !me) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  if (admin && !me.is_admin) return <Navigate to="/" replace />
  return <Outlet />
}
