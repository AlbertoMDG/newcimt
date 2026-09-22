import { useCustomerContacts, useCustomers } from '../api/client'
import type { CustomerContact } from '@shared/types'
import { Accordion, Card, EmailLink, EmptyState, ErrorNote, Loading, PageHeader, PhoneLink } from '../components/ui'

const SIDE_LABELS: Record<CustomerContact['side'], string> = {
  osi_primary: 'OSI primary',
  osi_alternate: 'OSI alternate',
  customer: 'Customer side',
}

function PersonCard({ c }: { c: CustomerContact }) {
  return (
    <Card>
      <p className="text-xs font-bold tracking-[0.12em] text-steel uppercase">{SIDE_LABELS[c.side]}</p>
      <p className="mt-1 font-bold">{c.name ?? '—'}</p>
      {c.title ? <p className="text-sm text-steel">{c.title}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <PhoneLink number={c.work_phone} label="work" />
        <PhoneLink number={c.cell_phone} label="cell" />
      </div>
      <EmailLink email={c.email} />
      {c.note ? <p className="mt-2 text-sm text-steel">{c.note}</p> : null}
    </Card>
  )
}

export function CustomersPage() {
  const { data: customers, isPending, error } = useCustomers()
  const { data: contacts } = useCustomerContacts()

  if (isPending) return <Loading />
  if (error) return <ErrorNote error={error} />

  return (
    <div>
      <PageHeader eyebrow="External" title="Customer contacts" />
      {(customers ?? []).length === 0 ? (
        <EmptyState title="No customers yet" to="/admin/customers" cta="Add in admin" />
      ) : (
        <div>
          {(customers ?? []).map((cust) => {
            const people = (contacts ?? []).filter((c) => c.customer_id === cust.customer_id)
            return (
              <Accordion key={cust.customer_id} heading={cust.name}>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {people.map((p) => <PersonCard key={p.id} c={p} />)}
                  {people.length === 0 ? (
                    <p className="text-sm text-steel">No contacts on file.</p>
                  ) : null}
                </div>
                {cust.notes ? <p className="mt-3 text-sm text-steel">{cust.notes}</p> : null}
              </Accordion>
            )
          })}
        </div>
      )}
    </div>
  )
}
