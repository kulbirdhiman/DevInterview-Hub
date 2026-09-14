import {
  Code,
  VideoCamera,
  LinkSimple,
  UsersThree,
  ChatCircleText,
  Monitor,
} from '@phosphor-icons/react/dist/ssr'
import Reveal from './Reveal'

const features = [
  {
    icon: Code,
    title: 'A real editor, not a text box',
    body: 'Monaco powers the editing surface, so bracket matching, indentation, and syntax highlighting behave the way candidates expect.',
  },
  {
    icon: VideoCamera,
    title: 'Video beside the code',
    body: 'Camera and microphone run in the same view as the problem, so you can read a pause instead of guessing at one.',
  },
  {
    icon: LinkSimple,
    title: 'One link per room',
    body: 'Every interview gets a room id. Send it, and whoever opens it lands in the same session.',
  },
  {
    icon: ChatCircleText,
    title: 'Realtime sync over websockets',
    body: 'Socket.IO carries room membership and call setup, so both sides stay in step without refreshing.',
  },
  {
    icon: UsersThree,
    title: 'Accounts that persist',
    body: 'Clerk handles sign in and webhooks write each profile into MongoDB, so returning candidates keep their history.',
  },
  {
    icon: Monitor,
    title: 'Any modern browser',
    body: 'WebRTC and the editor both run client side. There is no desktop client to approve and no extension to sideload.',
  },
]

export default function Features() {
  return (
    <section
      id="features"
      className="border-y border-zinc-200 bg-zinc-50 py-24 lg:py-32 dark:border-zinc-800 dark:bg-zinc-900/30"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <h2 className="max-w-[20ch] text-3xl leading-[1.1] font-semibold tracking-tighter text-balance text-zinc-950 sm:text-5xl dark:text-zinc-50">
            Everything the room needs
          </h2>
          <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
            Six pieces, and nothing else competing for the screen.
          </p>
        </Reveal>
      </div>

      {/* Horizontal rail. Scroll-snap keeps cards aligned at every width and
          keeps the section from becoming another grid of identical boxes. */}
      <Reveal delay={0.1}>
        <ul className="mt-14 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:px-6 [scrollbar-width:thin]">
          {features.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="w-[19rem] shrink-0 snap-start rounded-2xl border border-zinc-200 bg-white p-7 first:ml-0 sm:w-[22rem] dark:border-zinc-800 dark:bg-zinc-950"
            >
              <Icon
                size={24}
                weight="duotone"
                className="text-emerald-600 dark:text-emerald-400"
              />
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {title}
              </h3>
              <p className="mt-2 leading-relaxed text-zinc-600 dark:text-zinc-400">
                {body}
              </p>
            </li>
          ))}
          {/* Trailing spacer so the last card can snap clear of the edge. */}
          <li aria-hidden className="w-2 shrink-0" />
        </ul>
      </Reveal>
    </section>
  )
}
