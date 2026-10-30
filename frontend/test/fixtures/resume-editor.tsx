import { createRoot } from 'react-dom/client'
import ResumeView from '../../components/dashboard/ResumeView'
import { resumeContent } from '../../lib/resume/content'

createRoot(document.getElementById('root')!).render(<ResumeView
  resume={{ ...resumeContent({ title: 'Browser test resume', fullName: 'Asha Rao' }), _id: '123456789012345678901234', revision: 0, versionCount: 0, generatedByAI: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }}
  onSaved={() => {}}
  onBack={() => { document.title = 'All resumes' }}
/>)
