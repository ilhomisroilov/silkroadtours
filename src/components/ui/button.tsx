import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// shadcn/ui Button, restyled with the Silk Road tokens. Minimum target 44×44 px (WCAG 2.5.8).
export const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl font-bold tracking-[0.01em] transition-colors duration-200 disabled:pointer-events-none disabled:opacity-55 [&_svg]:size-[1.15em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-terracotta text-white hover:bg-terracotta-deep",
        secondary: "bg-lapis-deep text-ivory hover:bg-lapis",
        outline: "border border-lapis-deep bg-transparent text-lapis-deep hover:bg-lapis-deep hover:text-ivory",
        ghost: "text-lapis hover:bg-lapis/8",
        light: "bg-ivory text-lapis-deep hover:bg-sand",
        saffron: "bg-saffron text-ink hover:bg-saffron-soft",
        danger: "bg-danger text-white hover:bg-pomegranate",
        link: "min-h-0 rounded-none px-0 text-cobalt underline underline-offset-4 hover:text-lapis-deep",
      },
      size: {
        sm: "px-4 text-sm",
        md: "px-5 text-base",
        lg: "min-h-13 px-7 text-lg",
        icon: "size-11 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...(asChild ? {} : { type: type ?? "button" })}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
