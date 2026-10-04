import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

export const TooltipProvider=TooltipPrimitive.Provider;
export const Tooltip=TooltipPrimitive.Root;
export const TooltipTrigger=TooltipPrimitive.Trigger;

export const TooltipContent=React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({style,sideOffset=6,...props},ref)=>(
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      style={{
        zIndex:1100,
        padding:"6px 8px",
        border:"1px solid var(--border)",
        borderRadius:6,
        background:"var(--popover, var(--card))",
        color:"var(--foreground)",
        fontSize:12,
        boxShadow:"0 10px 30px rgba(0,0,0,.28)",
        ...style,
      }}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName="TooltipContent";
