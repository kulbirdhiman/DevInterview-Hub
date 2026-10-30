import { createRoot } from 'react-dom/client'
import InterviewRoom from '../../components/interviews/InterviewRoom'
import { interviewFixture } from './interview-data'
createRoot(document.getElementById('root')!).render(<InterviewRoom initial={interviewFixture} onBack={() => { document.title = 'All sessions' }} />)
