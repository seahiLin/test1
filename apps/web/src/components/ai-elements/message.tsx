// Adapted from Vercel AI Elements (Apache-2.0). Only presentation primitives retained.
import { cn } from '@/lib/utils'
import type { ComponentProps, HTMLAttributes } from 'react'
import { lazy, Suspense } from 'react'
import type { Streamdown } from 'streamdown'
export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: "user" | "assistant" | "system";
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full max-w-full flex-col gap-2",
      from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
      className
    )}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(
      "is-user:dark flex w-fit min-w-0 max-w-full flex-col gap-2 overflow-hidden text-base",
      "group-[.is-user]:ml-auto group-[.is-user]:rounded-2xl group-[.is-user]:bg-muted group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-foreground",
      "group-[.is-assistant]:text-foreground",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

const LazyResponse = lazy(() => import('./message-response'))
export function MessageResponse(props: ComponentProps<typeof Streamdown>) {
  return <Suspense fallback={<div className="whitespace-pre-wrap">{props.children}</div>}><LazyResponse {...props} /></Suspense>
}
