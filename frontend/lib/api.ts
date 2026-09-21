const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

/**
 * Network failures surface as an Error with an empty message in some browsers,
 * which would render a blank error box. Always give the user something to read.
 */
export function errorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message.trim() : ''
  return raw || 'Could not reach the server. Check it is running and try again.'
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * Calls the Express API with the caller's Clerk token attached.
 * `getToken` comes from Clerk's useAuth() so this stays usable from any
 * client component without reaching for a global.
 */
export async function apiFetch<T>(
  path: string,
  getToken: () => Promise<string | null>,
  init: RequestInit = {}
): Promise<T> {
  const token = await getToken()

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })

  // Clerk answers an unauthenticated API call with a 302 to its sign-in page.
  // fetch follows that, so a "successful" response can still be HTML. Treat
  // anything that is not JSON as a failure rather than handing the caller a
  // body it will destructure into undefined.
  const isJson = res.headers
    .get('content-type')
    ?.toLowerCase()
    .includes('application/json')

  let body: unknown = null
  if (isJson) {
    try {
      body = await res.json()
    } catch {
      // Malformed JSON is handled by the guards below.
    }
  }

  if (!res.ok) {
    const message =
      (body as { message?: string } | null)?.message ??
      `Request failed with status ${res.status}`
    throw new ApiError(message, res.status)
  }

  if (body === null || typeof body !== 'object') {
    throw new ApiError(
      'Your session has expired or the API is unreachable. Sign in again and retry.',
      401
    )
  }

  return body as T
}

/* ---- Shapes returned by the API ---- */

export type Resume = {
  _id: string
  title: string
  targetRole: string
  fullName: string
  headline: string
  summary: string
  skills: string[]
  experience: {
    company: string
    role: string
    start: string
    end: string
    bullets: string[]
  }[]
  projects: { name: string; description: string; tech: string[]; link: string }[]
  education: { school: string; degree: string; year: string }[]
  generatedByAI: boolean
  createdAt: string
  updatedAt: string
}

export type PrepQuestion = {
  _id: string
  prompt: string
  kind: 'coding' | 'system-design' | 'behavioural' | 'concept'
  difficulty: 'easy' | 'medium' | 'hard'
  lookFor: string[]
  answer: string
  answeredAt?: string
  score?: number
  feedback?: string
  strengths?: string[]
  improvements?: string[]
}

export type PrepSession = {
  _id: string
  targetRole: string
  stack: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  questions: PrepQuestion[]
  status: 'ready' | 'in-progress' | 'completed'
  createdAt: string
  updatedAt: string
}

export type Stats = {
  resumeCount: number
  sessionCount: number
  questionsAnswered: number
  averageScore: number | null
}

export type Profile = {
  bio: string
  skills: string[]
  github: string
  linkedin: string
  portfolio: string
  firstName?: string
  lastName?: string
  email?: string
}
