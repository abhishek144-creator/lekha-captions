import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef(({ className, trackClassName, rangeClassName, thumbClassName, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center", className)}
    {...props}>
    <SliderPrimitive.Track
      className={cn("relative h-[2px] w-full grow overflow-visible rounded-full bg-white/18", trackClassName)}>
      <SliderPrimitive.Range className={cn("absolute h-[2px] rounded-full bg-white", rangeClassName)} />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className={cn("block h-4 w-4 rounded-full border border-white bg-[#050505] shadow-[0_0_0_2px_#ffffff,0_0_0_5px_rgba(5,5,5,0.92),0_8px_16px_rgba(0,0,0,0.35)] transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white disabled:pointer-events-none disabled:opacity-50", thumbClassName)} />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
