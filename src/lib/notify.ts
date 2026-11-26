import "server-only";
import type { Db } from "@/db/client";
import { markBookingNotified } from "@/db/queries/bookings";
import { markServiceRequestNotified } from "@/db/queries/service-requests";
import {
  formatBookingMessage,
  formatServiceRequestMessage,
  sendTelegramMessage,
  type BookingNotification,
  type ServiceRequestNotification,
  type TelegramResult,
} from "./telegram";

function telegramConfig(env: CloudflareEnv) {
  return { botToken: env.TELEGRAM_BOT_TOKEN ?? "", chatId: env.TELEGRAM_CHAT_ID ?? "" };
}

/** Sends the booking alert to the agency's Telegram group and records delivery on the booking. */
export async function notifyBooking(db: Db, env: CloudflareEnv, booking: BookingNotification): Promise<TelegramResult> {
  const result = await sendTelegramMessage(telegramConfig(env), formatBookingMessage(booking, env.SITE_URL));
  if (result.ok) await markBookingNotified(db, booking.id, result.messageId);
  else console.error(`[telegram] booking ${booking.reference} not delivered: ${result.error}`);
  return result;
}

export async function notifyServiceRequest(
  db: Db,
  env: CloudflareEnv,
  request: ServiceRequestNotification,
): Promise<TelegramResult> {
  const result = await sendTelegramMessage(telegramConfig(env), formatServiceRequestMessage(request, env.SITE_URL));
  if (result.ok) await markServiceRequestNotified(db, request.id);
  else console.error(`[telegram] request ${request.reference} not delivered: ${result.error}`);
  return result;
}

export async function sendTelegramTest(env: CloudflareEnv, adminName: string): Promise<TelegramResult> {
  return sendTelegramMessage(
    telegramConfig(env),
    `✅ Test message from the booking site admin (sent by ${adminName.replace(/[<>&]/g, "")}). Booking alerts will arrive in this chat.`,
  );
}
