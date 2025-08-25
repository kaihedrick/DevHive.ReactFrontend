import type { Meta, StoryObj } from "@storybook/react";
import InputField from "./InputField";

const meta: Meta<typeof InputField> = {
  title: "Forms/InputField",
  component: InputField
};
export default meta;

type S = StoryObj<typeof InputField>;

export const Default: S = { args: { label: "Username", placeholder: "kai" } };
export const WithError: S = { args: { label: "Email", placeholder: "you@example.com", error: "Invalid email" } };
export const WithIcons: S = { args: { label: "Password", type: "password", leftIcon: "🔒", rightIcon: "👁️" } };
