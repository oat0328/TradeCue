import React, { useState } from "react";
import { useCoupons } from "../helpers/useCoupons";
import { couponInput } from "../helpers/couponRules";
import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  useForm,
} from "./Form";
import { Input } from "./Input";
import { Button } from "./Button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./Select";
import styles from "./CouponManager.module.css";

const durationPresets = [
  { label: "7 days", value: 7, unit: "days" as const },
  { label: "14 days", value: 14, unit: "days" as const },
  { label: "30 days", value: 30, unit: "days" as const },
  { label: "60 days", value: 60, unit: "days" as const },
  { label: "90 days", value: 90, unit: "days" as const },
  { label: "6 months", value: 6, unit: "months" as const },
  { label: "1 year", value: 12, unit: "months" as const },
];

export function CouponManager({ className = "" }: { className?: string }) {
  const { list, create, toggle } = useCoupons(true);
  const [copied, setCopied] = useState("");

  const form = useForm({
    schema: couponInput,
    defaultValues: {
      code: "",
      kind: "free_access",
      tier: "autopilot",
      durationValue: 90,
      durationUnit: "days",
      maxRedemptions: 100,
      redeemBy: new Date(Date.now() + 90 * 86400000).toISOString(),
    },
  });

  const set = (key: string, value: unknown) =>
    form.setValues((values) => ({ ...values, [key]: value }));

  const select = (
    name: string,
    label: string,
    options: [string, string][],
  ) => (
    <FormItem name={name}>
      <FormLabel>{label}</FormLabel>
      <Select
        value={String((form.values as any)[name])}
        onValueChange={(value) => {
          set(name, value);
          if (name === "kind") {
            set("durationUnit", value === "percent_discount" ? "months" : "days");
            set("durationValue", value === "percent_discount" ? 3 : 90);
            set("percentOff", value === "percent_discount" ? 20 : undefined);
          }
        }}
      >
        <FormControl>
          <SelectTrigger><SelectValue /></SelectTrigger>
        </FormControl>
        <SelectContent>
          {options.map(([value, optionLabel]) => (
            <SelectItem key={value} value={value}>{optionLabel}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  );

  const applyPreset = (value: number, unit: "days" | "months") => {
    set("durationValue", value);
    set("durationUnit", unit);
  };

  return (
    <section className={styles.panel + " " + className}>
      <div className={styles.head}>
        <div>
          <small>OWNER TOOLS</small>
          <h2>Coupon generator</h2>
          <p>Create named promo codes or let TradeCUE generate one automatically.</p>
        </div>
        <span>{list.data?.billingLive ? "Live billing" : "Billing test mode"}</span>
      </div>

      <Form {...form}>
        <form
          className={styles.grid}
          onSubmit={form.handleSubmit(async (values) => {
            await create.mutateAsync(values).catch(() => {});
          })}
        >
          <FormItem name="code">
            <FormLabel>Promo code</FormLabel>
            <FormControl>
              <Input
                value={form.values.code || ""}
                onChange={(event) =>
                  set("code", event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))
                }
                placeholder="TRADECUE2026 or leave blank"
                autoComplete="off"
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          {select("kind", "Coupon benefit", [
            ["free_access", "Free membership access"],
            ["percent_discount", "Percentage discount"],
          ])}

          {select("tier", "Membership", [
            ["scout", "Scout"],
            ["copilot", "Copilot"],
            ["autopilot", "Autopilot"],
          ])}

          {form.values.kind === "percent_discount" && (
            <FormItem name="percentOff">
              <FormLabel>Discount (%)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="1"
                  max="99"
                  value={form.values.percentOff ?? 20}
                  onChange={(event) => set("percentOff", Number(event.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}

          {form.values.kind === "free_access" && (
            <div className={styles.full}>
              <p>Quick duration presets</p>
              <div className={styles.presets}>
                {durationPresets.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    size="sm"
                    variant={
                      form.values.durationValue === preset.value &&
                      form.values.durationUnit === preset.unit
                        ? "secondary"
                        : "outline"
                    }
                    onClick={() => applyPreset(preset.value, preset.unit)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <FormItem name="durationValue">
            <FormLabel>
              {form.values.kind === "free_access" ? "Access duration" : "Discount duration"}
            </FormLabel>
            <FormControl>
              <Input
                type="number"
                min="1"
                max={form.values.durationUnit === "months" ? 24 : 365}
                value={form.values.durationValue}
                onChange={(event) => set("durationValue", Number(event.target.value))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          {select(
            "durationUnit",
            "Duration unit",
            form.values.kind === "percent_discount"
              ? [["months", "Months"]]
              : [["days", "Days"], ["months", "Months"]],
          )}

          <FormItem name="maxRedemptions">
            <FormLabel>Maximum uses</FormLabel>
            <FormControl>
              <Input
                type="number"
                min="1"
                max="100000"
                value={form.values.maxRedemptions}
                onChange={(event) => set("maxRedemptions", Number(event.target.value))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="redeemBy">
            <FormLabel>Last day to redeem (local time)</FormLabel>
            <FormControl>
              <Input
                type="datetime-local"
                value={(() => {
                  const date = new Date(form.values.redeemBy);
                  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
                    .toISOString()
                    .slice(0, 16);
                })()}
                onChange={(event) => {
                  if (event.target.value) set("redeemBy", new Date(event.target.value).toISOString());
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <div className={styles.full}>
            <p>
              Free access starts when redeemed and ends automatically. Percentage
              discounts apply to monthly subscription invoices for the selected
              duration, then standard pricing resumes. One use per member.
            </p>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Generating…" : "Generate coupon"}
            </Button>
          </div>
        </form>
      </Form>

      {create.error && <p role="alert" className={styles.error}>{create.error.message}</p>}
      {create.data && <p role="status">Created <strong>{create.data.code}</strong></p>}
      {list.isFetching && <p>Loading coupons…</p>}
      {list.error && <p role="alert">{list.error.message}</p>}
      {toggle.error && <p role="alert">{toggle.error.message}</p>}

      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Code</th><th>Benefit</th><th>Duration</th><th>Uses</th>
              <th>Redeem by</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.coupons.map((coupon) => (
              <tr key={coupon.id}>
                <td><strong>{coupon.code}</strong><small>{coupon.tier}</small></td>
                <td>{coupon.kind === "free_access" ? "Free access" : coupon.percentOff + "% off"}</td>
                <td>{coupon.durationValue} {coupon.durationUnit}</td>
                <td>
                  {coupon.used}/{coupon.maxRedemptions}
                  {coupon.reserved > 0 && <small>{coupon.reserved} in checkout</small>}
                </td>
                <td>{new Date(coupon.redeemBy).toLocaleDateString()}</td>
                <td>
                  {!coupon.active
                    ? "Disabled"
                    : new Date(coupon.redeemBy) < new Date()
                      ? "Expired"
                      : "Active"}
                </td>
                <td>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(coupon.code);
                        setCopied(coupon.code);
                      } catch {
                        setCopied("Copy unavailable—select the code");
                      }
                    }}
                  >
                    {copied === coupon.code ? "Copied" : "Copy"}
                  </Button>{" "}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate({ id: coupon.id, active: !coupon.active })}
                  >
                    {coupon.active ? "Disable" : "Enable"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.data?.coupons.length === 0 && <p>No coupons yet. Generate your first code above.</p>}
      </div>
    </section>
  );
}

