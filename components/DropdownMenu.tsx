import React from "react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";

export const DropdownMenu=Dropdown.Root;
export const DropdownMenuTrigger=Dropdown.Trigger;

export const DropdownMenuContent=React.forwardRef<
  React.ElementRef<typeof Dropdown.Content>,
  React.ComponentPropsWithoutRef<typeof Dropdown.Content>
>(({style,sideOffset=6,...props},ref)=>(
  <Dropdown.Portal>
    <Dropdown.Content
      ref={ref}
      sideOffset={sideOffset}
      style={{
        zIndex:1000,
        minWidth:150,
        padding:6,
        border:"1px solid var(--border)",
        borderRadius:8,
        background:"var(--popover, var(--card))",
        color:"var(--foreground)",
        boxShadow:"0 14px 42px rgba(0,0,0,.35)",
        ...style,
      }}
      {...props}
    />
  </Dropdown.Portal>
));
DropdownMenuContent.displayName="DropdownMenuContent";

export const DropdownMenuItem=React.forwardRef<
  React.ElementRef<typeof Dropdown.Item>,
  React.ComponentPropsWithoutRef<typeof Dropdown.Item>
>(({style,...props},ref)=>(
  <Dropdown.Item
    ref={ref}
    style={{
      display:"flex",
      alignItems:"center",
      gap:8,
      minHeight:32,
      padding:"6px 8px",
      borderRadius:6,
      cursor:"pointer",
      outline:"none",
      ...style,
    }}
    {...props}
  />
));
DropdownMenuItem.displayName="DropdownMenuItem";
