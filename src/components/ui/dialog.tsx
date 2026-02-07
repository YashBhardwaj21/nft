import * as React from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const DialogContext = React.createContext<{
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}>({});

const Dialog = ({ children, open, onOpenChange }: any) => {
    return (
        <DialogContext.Provider value={{ open, onOpenChange }}>
            {children}
        </DialogContext.Provider>
    );
};

const DialogTrigger = ({ children, asChild, ...props }: any) => {
    const { onOpenChange } = React.useContext(DialogContext);
    return (
        <div onClick={() => onOpenChange?.(true)} {...props} className={cn("cursor-pointer", props.className)}>
            {children}
        </div>
    );
}

const DialogPortal = ({ children }: any) => {
    const { open } = React.useContext(DialogContext);
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center sm:items-center">
            {children}
        </div>
    );
}

const DialogOverlay = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-all duration-100 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in",
            className
        )}
        {...props}
    />
))
DialogOverlay.displayName = "DialogOverlay"

const DialogContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
    const { onOpenChange } = React.useContext(DialogContext);

    return (
        <DialogPortal>
            <DialogOverlay onClick={() => onOpenChange?.(false)} />
            <div
                ref={ref}
                className={cn(
                    "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg",
                    className
                )}
                {...props}
            >
                {children}
                <button
                    type="button"
                    onClick={() => onOpenChange?.(false)}
                    className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground text-white/50 hover:text-white"
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </button>
            </div>
        </DialogPortal>
    );
})
DialogContent.displayName = "DialogContent"

const DialogHeader = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            "flex flex-col space-y-1.5 text-center sm:text-left",
            className
        )}
        {...props}
    />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
            className
        )}
        {...props}
    />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
    HTMLHeadingElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h3
        ref={ref}
        className={cn(
            "text-lg font-semibold leading-none tracking-tight",
            className
        )}
        {...props}
    />
))
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
    />
))
DialogDescription.displayName = "DialogDescription"

const DialogClose = ({ children, ...props }: any) => {
    const { onOpenChange } = React.useContext(DialogContext);
    return <div onClick={() => onOpenChange?.(false)} {...props}>{children}</div>
}

export {
    Dialog,
    DialogPortal,
    DialogOverlay,
    DialogClose,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
}
