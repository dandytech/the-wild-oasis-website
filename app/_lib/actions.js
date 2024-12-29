"use server";

import { revalidatePath } from "next/cache";
import { auth, signIn, signOut } from "./auth";
import { supabase } from "./supabase";
import { getBookings } from "./data-service";
import { redirect } from "next/navigation";

//these are actions to be called in server components that doesn't need user interactions
export async function updateGuest(formData) {
  const session = await auth();

  if (!session) throw new Error("You must be logged in");

  const nationalID = formData.get("nationalID");
  const [nationality, countryFlag] = formData.get("nationality").split("%");

  //nationalId must be up to 6 to 12 characters long and be alphanumeric

  if (!/^[a-zA-Z0-9]{6,12}$/.test(nationalID))
    throw new Error("Please provide a valid national ID");

  const updateData = { nationality, countryFlag, nationalID };

  const { data, error } = await supabase
    .from("guests")
    .update(updateData)
    .eq("id", session.user.guestId);

  if (error) throw new Error("Guest could not be updated");

  //clear old data and fetch updated ones
  revalidatePath("/account/profile");
}

export async function createBooking(bookingData, formData) {
  //console.log(formData);
  const session = await auth();
  if (!session) throw new Error("You must be logged in");

  const newBooking = {
    ...bookingData,
    guestId: session.user.guestId,
    numGuests: Number(formData.get("numGuests")),
    observations: formData.get("observations").slice(0, 1000),
    extrasPrice: 0,
    totalPrice: bookingData.cabinPrice,
    isPaid: false,
    hasBreakfast: false,
    status: "unconfirmed",
  };

  const { error } = await supabase.from("bookings").insert([newBooking]);

  if (error) {
    console.log("Supabase Error:", error);
    throw new Error(`Booking could not be created: ${error.message}`);
  }

  revalidatePath(`/cabins/${bookingData.cabinId}`);

  redirect("/cabins/thankyou");
}

export async function deleteBooking(bookingId) {
  //artificial delay to test useOptimistic Hook
  // await new Promise((res) => setTimeout(res, 2000));
  //throw new Error(); //used to check revert ability of useOptmistic hook

  const session = await auth();
  if (!session) throw new Error("You must be logged in");

  //check if the booking belongs to the guest
  const guestBookings = await getBookings(session.user.guestId); //get all guests booking
  const guestBookingIds = guestBookings.map((booking) => booking.id); //get all guests id

  if (!guestBookingIds.includes(bookingId))
    throw new Error("You are not allowed to delete this booking");

  const { error } = await supabase
    .from("bookings")
    .delete()
    .eq("id", bookingId);

  if (error) throw new Error("Booking could not be deleted");

  revalidatePath("/account/reservations");
}

export async function updateBooking(formData) {
  console.log(formData);

  //grb id from the hidden input
  const bookingId = Number(formData.get("bookingId"));

  //1. Authentication
  const session = await auth();
  if (!session) throw new Error("You must be logged in");

  //2. Authorization
  //check if the booking belongs to the guest
  const guestBookings = await getBookings(session.user.guestId); //get all guests booking
  const guestBookingIds = guestBookings.map((booking) => booking.id); //get all guests id

  if (!guestBookingIds.includes(bookingId))
    throw new Error("You are not allowed to update this booking");

  //3. Building the update data
  // 3. Building the update data
  const updateData = {
    numGuests: Number(formData.get("numGuests")),
    observations: formData
      .get("observations")
      .replace(/^\["|"]$/g, "") // Remove [" and "]
      .slice(0, 1000), // Take only the first 1000 characters
  };

  //4. Mutation
  const { error } = await supabase
    .from("bookings")
    .update(updateData)
    .eq("id", bookingId)
    .select()
    .single();

  //5. Error handling
  if (error) throw new Error("Booking could not be updated");

  //6. Revalidation
  revalidatePath(`/account/reservations/edit/${bookingId}`); //inner page

  revalidatePath("/account/reservations");

  //7. Redirection
  redirect("/account/reservations");
}

export async function signInAction() {
  await signIn("google", { redirectTo: "/account" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
