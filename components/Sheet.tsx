import React,{forwardRef} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import styles from "./Sheet.module.css";
export const Sheet=Dialog.Root;
export const SheetHeader=({children,className,...props}:React.HTMLAttributes<HTMLDivElement>)=>
  <div className={[styles.header,className].filter(Boolean).join(" ")} {...props}>{children}</div>;
export const SheetTitle=Dialog.Title;
export const SheetDescription=Dialog.Description;
type SheetContentProps=React.ComponentPropsWithoutRef<typeof Dialog.Content>&{side?:"left"|"right"};
export const SheetContent=forwardRef<HTMLDivElement,SheetContentProps>(
 function SheetContent({side="right",className,children,...props},ref){
   return <Dialog.Portal>
     <Dialog.Overlay className={styles.overlay}/>
     <Dialog.Content ref={ref} className={[styles.content,side==="left"?styles.left:styles.right,className].filter(Boolean).join(" ")} {...props}>
       <Dialog.Close className={styles.close} aria-label="Close panel">×</Dialog.Close>
       {children}
     </Dialog.Content>
   </Dialog.Portal>;
 });
