import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import { useAuth } from "../../auth/AuthProvider";
import { supabase } from "../../lib/supabase";
import { MY_PROFILE_KEY, type MyProfile } from "../auth/account";

const AVATAR_BUCKET = "customer-avatars";
const AVATAR_SIDE_PX = 512; // WHY: far under the 2 MB bucket limit and sharp enough for a 56–96 pt avatar.

export type ProfileChanges = {
  first_name: string;
  last_name: string;
  push_opt_in: boolean;
  /** Storage path inside customer-avatars; unchanged one keeps the current photo. */
  avatar_path: string | null;
};

export const avatarUrl = (path: string | null): string | null =>
  path ? supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl : null;

export class AvatarPermissionError extends Error {}

/** Library picker with a square crop; null when the user cancels. Throws if permission is denied. */
export async function pickAvatar(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new AvatarPermissionError();
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  const resized = await ImageManipulator.ImageManipulator.manipulate(asset.uri).resize({ width: AVATAR_SIDE_PX }).renderAsync();
  const saved = await resized.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 });
  return saved.uri;
}

async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const path = `${userId}/${Date.now()}.jpg`;
  const body = await (await fetch(localUri)).arrayBuffer();
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, body, { contentType: "image/jpeg" });
  if (error) throw error;
  return path;
}

/** E-23 fields first_name/last_name/avatar_path/push_opt_in. A new photo (local uri) is uploaded first. */
export function useUpdateProfile() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id ?? "";
  return useMutation({
    mutationFn: async ({ changes, newPhotoUri }: { changes: ProfileChanges; newPhotoUri: string | null }) => {
      const avatarPath = newPhotoUri ? await uploadAvatar(userId, newPhotoUri) : changes.avatar_path;
      const { data, error } = await supabase.rpc("update_profile", {
        p_first_name: changes.first_name,
        p_last_name: changes.last_name,
        p_avatar_path: avatarPath as string,
        p_push_opt_in: changes.push_opt_in,
      });
      if (error) throw error;
      return data as unknown as MyProfile;
    },
    onSuccess: (profile) => queryClient.setQueryData([...MY_PROFILE_KEY, userId], profile),
  });
}
