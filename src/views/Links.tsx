import { LINKS } from '../domain/links'
import { Pill } from './ui'

export function AppLinks({ ids }: { ids: (keyof typeof LINKS)[] }) {
  return (
    <ul className="grid sm:grid-cols-2 gap-2">
      {ids.map((id) => { const l = LINKS[id]; return (
        <li key={id} className="rounded border border-lab-line p-2 text-xs space-y-1">
          <p className="flex items-center gap-2">{l.url ? <a className="text-lab-fda underline-offset-2 hover:underline" href={l.url} target="_blank" rel="noreferrer">{l.name} ↗</a> : <span className="text-lab-text">{l.name}</span>}
            <Pill tone={l.status === 'live' ? 'green' : l.status === 'repository' ? 'blue' : 'grey'}>{l.status === 'live' ? 'live app' : l.status === 'repository' ? 'code repository' : 'planned'}</Pill></p>
          <p className="text-lab-text-muted">{l.why}</p>
        </li>
      ) })}
    </ul>
  )
}
