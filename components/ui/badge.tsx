import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 before:size-1.5 before:rounded-full before:bg-current aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "border-[#A6DCB5] bg-[#EBF7EE] text-[#002E63] [a]:hover:bg-[#CFECD7]",
        secondary:
          "border-[#A6DCB5] bg-[#EBF7EE] text-[#002E63] [a]:hover:bg-[#CFECD7]",
        destructive:
          "border-[#FACDCB] bg-[#FDECEB] text-[#A32421] focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-[#FACDCB]",
        outline:
          "border-border bg-card text-foreground before:bg-muted-foreground [a]:hover:bg-muted [a]:hover:text-foreground",
        ghost:
          "border-transparent bg-transparent text-muted-foreground before:bg-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted/50",
        link: "h-auto rounded-none border-0 bg-transparent px-0 text-primary before:hidden underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }

