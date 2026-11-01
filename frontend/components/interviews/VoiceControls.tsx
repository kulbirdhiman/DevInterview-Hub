'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/dashboard/ui'

type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean
  start: () => void; abort: () => void
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null; onend: (() => void) | null
}
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
export default function VoiceControls({ prompt, language, disabled, onTranscript }: { prompt: string; language: string; disabled: boolean; onTranscript: (text: string) => void }) {
  const [listening, setListening] = useState(false), [message, setMessage] = useState('')
  const recognition = useRef<Recognition | null>(null)
  useEffect(() => () => { recognition.current?.abort(); window.speechSynthesis?.cancel() }, [])
  useEffect(() => { if (disabled) { recognition.current?.abort(); window.speechSynthesis?.cancel() } }, [disabled])
  function dictate() {
    const Constructor = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition
    if (!Constructor) { setMessage('Speech recognition is unavailable in this browser. Type your answer below.'); return }
    window.speechSynthesis?.cancel()
    const instance = new Constructor(); recognition.current = instance
    instance.lang = language === 'Hindi' ? 'hi-IN' : 'en-IN'; instance.continuous = false; instance.interimResults = false
    instance.onresult = event => { const text = Array.from(event.results).map(result => result[0]?.transcript ?? '').join(' '); onTranscript(text) }
    instance.onerror = () => { setMessage('Microphone or speech recognition unavailable. You can continue typing.'); setListening(false) }
    instance.onend = () => { setListening(false); recognition.current = null }
    try { instance.start(); setListening(true); setMessage('Listening. Your transcript will appear for review; it is never submitted automatically.') }
    catch { setMessage('Could not start the microphone. Continue typing or try again.'); setListening(false) }
  }
  return <div className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
    <p className="text-sm font-medium">Voice prototype</p>
    <p className="text-xs text-zinc-500">Optional browser speech services may send microphone audio to your browser provider. Start only if you consent. This app stores submitted text, with no audio recording. Review transcription before submitting.</p>
    <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" disabled={disabled || listening} onClick={() => {
      if (!window.speechSynthesis) { setMessage('Speech playback unavailable. Read the question above.'); return }
      window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(prompt); utterance.lang = language === 'Hindi' ? 'hi-IN' : 'en-IN'; window.speechSynthesis.speak(utterance)
    }}>Read question aloud</Button><Button type="button" variant="secondary" disabled={disabled} onClick={() => { if (listening) { recognition.current?.abort(); setListening(false) } else dictate() }}>{listening ? 'Stop microphone' : 'Start dictation'}</Button><Button type="button" variant="ghost" onClick={() => window.speechSynthesis?.cancel()}>Stop playback</Button></div>
    {message && <p role="status" className="text-sm">{message}</p>}
  </div>
}
