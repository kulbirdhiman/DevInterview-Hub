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
 * Calls the API with the caller's Clerk token attached.
 * `getToken` comes from Clerk's useAuth() so this stays usable from any
 * client component without reaching for a global.
 */
export async function apiFetch<T>(
  path: string,
  getToken: () => Promise<string | null>,
  init: RequestInit = {}
): Promise<T> {
  const token = await getToken()
  if (!token) throw new ApiError('Sign in to continue.', 401)

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })

  // A misconfigured proxy or an older API deployment may redirect to HTML.
  // Treat non-JSON responses as failures instead of accepting a sign-in page
  // as a successful API response.
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

export type ResumePresentation = {
  template: 'classic' | 'modern' | 'minimal'
  font: 'sans' | 'serif' | 'mono'
  fontSize: 'small' | 'medium' | 'large'
  spacing: 'compact' | 'comfortable' | 'spacious'
  color: 'slate' | 'emerald' | 'blue' | 'burgundy'
}
export type ResumeContent = {
  title: string
  targetRole: string
  fullName: string
  headline: string
  summary: string
  contact: { email: string; phone: string; location: string; website: string; linkedin: string; github: string }
  skills: string[]
  experience: { id?: string; company: string; role: string; start: string; end: string; bullets: string[] }[]
  projects: { id?: string; name: string; description: string; tech: string[]; link: string }[]
  education: { id?: string; school: string; degree: string; year: string }[]
  certifications: { id?: string; name: string; issuer: string; date: string; link: string }[]
  achievements: { id?: string; title: string; description: string; date: string }[]
  customSections: { id: string; title: string; body: string }[]
  sectionOrder: string[]
  presentation: ResumePresentation
}
export type Resume = ResumeContent & {
  _id: string
  revision: number
  versionCount: number
  generatedByAI: boolean
  createdAt: string
  updatedAt: string
}
export type ResumeVersion = { _id: string; label: string; createdAt: string; sourceRevision: number; schemaVersion: number }

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
  displayName: string
  education: string
  experienceLevel: '' | 'student' | 'fresher' | 'early-career' | 'experienced'
  targetRole: string
  targetIndustry: string
  careerGoals: string
  interviewLanguage: 'English' | 'Hindi'
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: 'INR' | 'USD' | 'EUR' | 'GBP'
  bio: string
  skills: string[]
  github: string
  linkedin: string
  portfolio: string
  firstName?: string
  lastName?: string
  email?: string
  onboardingCompletedAt?: string | null
}

export const emptyProfile: Profile = {
  displayName: '', education: '', experienceLevel: '', targetRole: '',
  targetIndustry: '', careerGoals: '', interviewLanguage: 'English',
  salaryMin: null, salaryMax: null, salaryCurrency: 'INR', skills: [],
  bio: '', github: '', linkedin: '', portfolio: '',
}
