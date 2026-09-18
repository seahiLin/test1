import { createFileRoute } from '@tanstack/react-router'
import { Home } from '@/features/auth/home'

export const Route = createFileRoute('/')({ component: Home })
