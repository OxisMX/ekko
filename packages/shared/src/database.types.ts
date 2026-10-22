
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "card_cycles": {
                  Row: {
                    "closed_at": string | null,"customer_id": string,"expires_at": string,"id": string,"merchant_id": string,"reward_description": string,"reward_title": string,"stamps_count": number,"stamps_required": number,"started_at": string,"status": Database["public"]['Enums']["cycle_status"],"terms": string
                  }
                  ComputedFields: never
                  Insert: {
                    "closed_at"?: string | null,"customer_id": string,"expires_at": string,"id"?: string,"merchant_id": string,"reward_description": string,"reward_title": string,"stamps_count"?: number,"stamps_required": number,"started_at"?: string,"status": Database["public"]['Enums']["cycle_status"],"terms": string
                  }
                  Update: {
                    "closed_at"?: string | null,"customer_id"?: string,"expires_at"?: string,"id"?: string,"merchant_id"?: string,"reward_description"?: string,"reward_title"?: string,"stamps_count"?: number,"stamps_required"?: number,"started_at"?: string,"status"?: Database["public"]['Enums']["cycle_status"],"terms"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "card_cycles_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "card_cycles_merchant_id_fkey"
      columns: ["merchant_id"]
isOneToOne: false
      referencedRelation: "merchants"
      referencedColumns: ["id"]
    }
                  ]
                },"coupons": {
                  Row: {
                    "birthday_year": number | null,"campaign_id": string | null,"code": string,"customer_id": string,"cycle_id": string | null,"description": string,"expires_at": string,"id": string,"issued_at": string,"merchant_id": string,"redeemed_at": string | null,"source": Database["public"]['Enums']["coupon_source"],"spin_id": string | null,"status": Database["public"]['Enums']["coupon_status"],"terms": string | null,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "birthday_year"?: number | null,"campaign_id"?: string | null,"code": string,"customer_id": string,"cycle_id"?: string | null,"description": string,"expires_at": string,"id"?: string,"issued_at"?: string,"merchant_id": string,"redeemed_at"?: string | null,"source": Database["public"]['Enums']["coupon_source"],"spin_id"?: string | null,"status"?: Database["public"]['Enums']["coupon_status"],"terms"?: string | null,"title": string
                  }
                  Update: {
                    "birthday_year"?: number | null,"campaign_id"?: string | null,"code"?: string,"customer_id"?: string,"cycle_id"?: string | null,"description"?: string,"expires_at"?: string,"id"?: string,"issued_at"?: string,"merchant_id"?: string,"redeemed_at"?: string | null,"source"?: Database["public"]['Enums']["coupon_source"],"spin_id"?: string | null,"status"?: Database["public"]['Enums']["coupon_status"],"terms"?: string | null,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "coupons_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "push_campaigns"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coupons_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coupons_cycle_id_fkey"
      columns: ["cycle_id"]
isOneToOne: true
      referencedRelation: "card_cycles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coupons_merchant_id_fkey"
      columns: ["merchant_id"]
isOneToOne: false
      referencedRelation: "merchants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coupons_spin_id_fkey"
      columns: ["spin_id"]
isOneToOne: true
      referencedRelation: "wheel_spins"
      referencedColumns: ["id"]
    }
                  ]
                },"customer_devices": {
                  Row: {
                    "customer_id": string,"device_hash": string,"expo_push_token": string | null,"id": string,"last_seen_at": string,"platform": Database["public"]['Enums']["device_platform"],"push_enabled": boolean,"signed_out_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "customer_id": string,"device_hash": string,"expo_push_token"?: string | null,"id"?: string,"last_seen_at"?: string,"platform": Database["public"]['Enums']["device_platform"],"push_enabled"?: boolean,"signed_out_at"?: string | null
                  }
                  Update: {
                    "customer_id"?: string,"device_hash"?: string,"expo_push_token"?: string | null,"id"?: string,"last_seen_at"?: string,"platform"?: Database["public"]['Enums']["device_platform"],"push_enabled"?: boolean,"signed_out_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "customer_devices_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    }
                  ]
                },"customer_merchants": {
                  Row: {
                    "created_at": string,"customer_id": string,"merchant_id": string,"origin": Database["public"]['Enums']["relation_origin"],"pending_extra_stamps": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"customer_id": string,"merchant_id": string,"origin": Database["public"]['Enums']["relation_origin"],"pending_extra_stamps"?: number
                  }
                  Update: {
                    "created_at"?: string,"customer_id"?: string,"merchant_id"?: string,"origin"?: Database["public"]['Enums']["relation_origin"],"pending_extra_stamps"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "customer_merchants_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "customer_merchants_merchant_id_fkey"
      columns: ["merchant_id"]
isOneToOne: false
      referencedRelation: "merchants"
      referencedColumns: ["id"]
    }
                  ]
                },"customers": {
                  Row: {
                    "auth_provider": string,"auth_user_id": string | null,"birth_date": string | null,"created_at": string,"deleted_at": string | null,"email_verified_at": string | null,"first_name": string | null,"id": string,"last_name": string | null,"status": Database["public"]['Enums']["customer_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth_provider": string,"auth_user_id"?: string | null,"birth_date"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"email_verified_at"?: string | null,"first_name"?: string | null,"id"?: string,"last_name"?: string | null,"status"?: Database["public"]['Enums']["customer_status"],"updated_at"?: string
                  }
                  Update: {
                    "auth_provider"?: string,"auth_user_id"?: string | null,"birth_date"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"email_verified_at"?: string | null,"first_name"?: string | null,"id"?: string,"last_name"?: string | null,"status"?: Database["public"]['Enums']["customer_status"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"loyalty_programs": {
                  Row: {
                    "card_background_path": string | null,"cycle_months": number,"merchant_id": string,"reward_description": string,"reward_title": string,"stamps_required": number,"terms": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "card_background_path"?: string | null,"cycle_months"?: number,"merchant_id": string,"reward_description": string,"reward_title": string,"stamps_required"?: number,"terms": string,"updated_at"?: string
                  }
                  Update: {
                    "card_background_path"?: string | null,"cycle_months"?: number,"merchant_id"?: string,"reward_description"?: string,"reward_title"?: string,"stamps_required"?: number,"terms"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "loyalty_programs_merchant_id_fkey"
      columns: ["merchant_id"]
isOneToOne: true
      referencedRelation: "merchants"
      referencedColumns: ["id"]
    }
                  ]
                },"menu_categories": {
                  Row: {
                    "id": string,"merchant_id": string,"name": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"merchant_id": string,"name": string,"position": number
                  }
                  Update: {
                    "id"?: string,"merchant_id"?: string,"name"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "menu_categories_merchant_id_fkey"
      columns: ["merchant_id"]
isOneToOne: false
      referencedRelation: "merchants"
      referencedColumns: ["id"]
    }
                  ]
                },"merchants": {
                  Row: {
                    "address": string,"auth_user_id": string,"billing_period": Database["public"]['Enums']["billing_period"],"birthday_benefit": string | null,"category": Database["public"]['Enums']["merchant_category"],"cover_path": string,"created_at": string,"description": string,"id": string,"is_active": boolean,"is_visible": boolean,"logo_path": string,"maps_url": string,"name": string,"paid_until": string,"push_coupon_validity_hours": number,"reviews_url": string,"subscription_status": Database["public"]['Enums']["subscription_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address": string,"auth_user_id": string,"billing_period": Database["public"]['Enums']["billing_period"],"birthday_benefit"?: string | null,"category": Database["public"]['Enums']["merchant_category"],"cover_path": string,"created_at"?: string,"description": string,"id"?: string,"is_active"?: boolean,"is_visible"?: boolean,"logo_path": string,"maps_url": string,"name": string,"paid_until": string,"push_coupon_validity_hours"?: number,"reviews_url": string,"subscription_status": Database["public"]['Enums']["subscription_status"],"updated_at"?: string
                  }
                  Update: {
                    "address"?: string,"auth_user_id"?: string,"billing_period"?: Database["public"]['Enums']["billing_period"],"birthday_benefit"?: string | null,"category"?: Database["public"]['Enums']["merchant_category"],"cover_path"?: string,"created_at"?: string,"description"?: string,"id"?: string,"is_active"?: boolean,"is_visible"?: boolean,"logo_path"?: string,"maps_url"?: string,"name"?: string,"paid_until"?: string,"push_coupon_validity_hours"?: number,"reviews_url"?: string,"subscription_status"?: Database["public"]['Enums']["subscription_status"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"products": {
                  Row: {
                    "category_id": string,"created_at": string,"description": string | null,"id": string,"image_path": string | null,"is_featured": boolean,"merchant_id": string,"name": string,"position": number,"price": number,"sold_out_on": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"created_at"?: string,"description"?: string | null,"id"?: string,"image_path"?: string | null,"is_featured"?: boolean,"merchant_id": string,"name": string,"position": number,"price": number,"sold_out_on"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "category_id"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"image_path"?: string | null,"is_featured"?: boolean,"merchant_id"?: string,"name"?: string,"position"?: number,"price"?: number,"sold_out_on"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "menu_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_merchant_id_fkey"
      columns: ["merchant_id"]
isOneToOne: false
      referencedRelation: "merchants"
      referencedColumns: ["id"]
    }
                  ]
                },"push_campaigns": {
                  Row: {
                    "body": string,"coupon_description": string | null,"coupon_terms": string | null,"coupon_title": string | null,"coupon_validity_hours": number | null,"created_at": string,"failed_count": number,"has_coupon": boolean,"id": string,"idempotency_key": string,"local_month": string,"merchant_id": string,"recipients_count": number,"sent_count": number,"status": Database["public"]['Enums']["campaign_status"],"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"coupon_description"?: string | null,"coupon_terms"?: string | null,"coupon_title"?: string | null,"coupon_validity_hours"?: number | null,"created_at"?: string,"failed_count"?: number,"has_coupon": boolean,"id"?: string,"idempotency_key": string,"local_month": string,"merchant_id": string,"recipients_count"?: number,"sent_count"?: number,"status": Database["public"]['Enums']["campaign_status"],"title": string
                  }
                  Update: {
                    "body"?: string,"coupon_description"?: string | null,"coupon_terms"?: string | null,"coupon_title"?: string | null,"coupon_validity_hours"?: number | null,"created_at"?: string,"failed_count"?: number,"has_coupon"?: boolean,"id"?: string,"idempotency_key"?: string,"local_month"?: string,"merchant_id"?: string,"recipients_count"?: number,"sent_count"?: number,"status"?: Database["public"]['Enums']["campaign_status"],"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_campaigns_merchant_id_fkey"
      columns: ["merchant_id"]
isOneToOne: false
      referencedRelation: "merchants"
      referencedColumns: ["id"]
    }
                  ]
                },"stamps": {
                  Row: {
                    "customer_id": string,"cycle_id": string,"granted_at": string,"id": string,"is_bonus": boolean,"local_date": string,"merchant_id": string,"qr_token_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "customer_id": string,"cycle_id": string,"granted_at"?: string,"id"?: string,"is_bonus"?: boolean,"local_date": string,"merchant_id": string,"qr_token_id"?: string | null
                  }
                  Update: {
                    "customer_id"?: string,"cycle_id"?: string,"granted_at"?: string,"id"?: string,"is_bonus"?: boolean,"local_date"?: string,"merchant_id"?: string,"qr_token_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stamps_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stamps_cycle_id_fkey"
      columns: ["cycle_id"]
isOneToOne: false
      referencedRelation: "card_cycles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stamps_merchant_id_fkey"
      columns: ["merchant_id"]
isOneToOne: false
      referencedRelation: "merchants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stamps_qr_token_id_fkey"
      columns: ["qr_token_id"]
isOneToOne: false
      referencedRelation: "visit_qr_tokens"
      referencedColumns: ["id"]
    }
                  ]
                },"visit_qr_tokens": {
                  Row: {
                    "claim_result": Json | null,"created_at": string,"expires_at": string,"id": string,"invalidated_at": string | null,"merchant_id": string,"token_hash": string,"used_at": string | null,"used_by_customer_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "claim_result"?: Json | null,"created_at"?: string,"expires_at": string,"id"?: string,"invalidated_at"?: string | null,"merchant_id": string,"token_hash": string,"used_at"?: string | null,"used_by_customer_id"?: string | null
                  }
                  Update: {
                    "claim_result"?: Json | null,"created_at"?: string,"expires_at"?: string,"id"?: string,"invalidated_at"?: string | null,"merchant_id"?: string,"token_hash"?: string,"used_at"?: string | null,"used_by_customer_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "visit_qr_tokens_merchant_id_fkey"
      columns: ["merchant_id"]
isOneToOne: false
      referencedRelation: "merchants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visit_qr_tokens_used_by_customer_id_fkey"
      columns: ["used_by_customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    }
                  ]
                },"weekly_offers": {
                  Row: {
                    "description": string,"id": string,"image_path": string | null,"merchant_id": string,"position": number,"title": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "description": string,"id"?: string,"image_path"?: string | null,"merchant_id": string,"position": number,"title": string,"weekday": number
                  }
                  Update: {
                    "description"?: string,"id"?: string,"image_path"?: string | null,"merchant_id"?: string,"position"?: number,"title"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "weekly_offers_merchant_id_fkey"
      columns: ["merchant_id"]
isOneToOne: false
      referencedRelation: "merchants"
      referencedColumns: ["id"]
    }
                  ]
                },"wheel_spins": {
                  Row: {
                    "customer_id": string,"device_hash": string,"email_hash": string,"id": string,"merchant_id": string,"prize_id": string,"spun_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "customer_id": string,"device_hash": string,"email_hash": string,"id"?: string,"merchant_id": string,"prize_id": string,"spun_at"?: string
                  }
                  Update: {
                    "customer_id"?: string,"device_hash"?: string,"email_hash"?: string,"id"?: string,"merchant_id"?: string,"prize_id"?: string,"spun_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "wheel_spins_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wheel_spins_merchant_id_fkey"
      columns: ["merchant_id"]
isOneToOne: false
      referencedRelation: "merchants"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "add_card":
{ Args: { "p_merchant_id": string }; Returns: Json
                           },
"claim_visit":
{ Args: { "p_device_id_digest": string,"p_token": string }; Returns: Json
                           },
"complete_profile":
{ Args: { "p_birth_date": string,"p_first_name": string,"p_last_name": string }; Returns: Json
                           },
"confirm_redemption":
{ Args: { "p_coupon_id": string }; Returns: Json
                           },
"create_push_campaign":
{ Args: { "p_auth_session_id": string,"p_merchant_id": string,"p_payload": Json }; Returns: Json
                           },
"delete_menu_category":
{ Args: { "p_id": string }; Returns: undefined
                           },
"delete_offer":
{ Args: { "p_id": string }; Returns: undefined
                           },
"delete_product":
{ Args: { "p_id": string }; Returns: undefined
                           },
"ensure_birthday_coupons":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"generate_visit_qr":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_card_config":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_merchant_detail":
{ Args: { "p_merchant_id": string }; Returns: Json
                           },
"get_merchant_session":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_my_profile":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_push_recipients":
{ Args: { "p_campaign_id": string }; Returns: {
              "coupon_id": string,"customer_id": string,"token": string
            }[]
                           },
"get_push_status":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_qr_status":
{ Args: { "p_qr_id": string }; Returns: Json
                           },
"get_wheel":
{ Args: { "p_merchant_id": string }; Returns: Json
                           },
"list_menu_admin":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"list_merchants":
{ Args: { "p_category"?: Database["public"]['Enums']["merchant_category"],"p_limit"?: number,"p_offset"?: number,"p_query"?: string,"p_seed": string }; Returns: Json
                           },
"list_my_cards":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"list_my_coupons":
{ Args: { "p_merchant_id"?: string }; Returns: Json
                           },
"list_my_redemptions":
{ Args: { "p_limit"?: number,"p_offset"?: number }; Returns: Json
                           },
"list_offers_admin":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"list_push_campaigns":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"lock_admin":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"lookup_redemption":
{ Args: { "p_code": string }; Returns: Json
                           },
"record_push_result":
{ Args: { "p_campaign_id": string,"p_failed": number,"p_invalid_tokens": (string)[],"p_sent": number }; Returns: Json
                           },
"register_device":
{ Args: { "p_device_id_digest": string,"p_expo_push_token"?: string,"p_platform": Database["public"]['Enums']["device_platform"],"p_push_enabled"?: boolean }; Returns: Json
                           },
"reveal_coupon_code":
{ Args: { "p_coupon_id": string }; Returns: Json
                           },
"set_product_flags":
{ Args: { "p_id": string,"p_is_featured": boolean,"p_sold_out_today": boolean }; Returns: Json
                           },
"sign_out_device":
{ Args: { "p_device_id_digest": string }; Returns: Json
                           },
"spin_wheel":
{ Args: { "p_device_id_digest": string,"p_merchant_id": string }; Returns: Json
                           },
"unlock_admin":
{ Args: { "p_pin": string }; Returns: Json
                           },
"update_card_config":
{ Args: { "p_card_background_path": string,"p_cycle_months": number,"p_push_coupon_validity_hours": number,"p_reward_description": string,"p_reward_title": string,"p_stamps_required": number,"p_terms": string }; Returns: Json
                           },
"upsert_menu_category":
{ Args: { "p_id"?: string,"p_name"?: string,"p_position"?: number }; Returns: Json
                           },
"upsert_offer":
{ Args: { "p_description"?: string,"p_id"?: string,"p_image_path"?: string,"p_position"?: number,"p_title"?: string,"p_weekday"?: number }; Returns: Json
                           },
"upsert_product":
{ Args: { "p_category_id"?: string,"p_description"?: string,"p_id"?: string,"p_image_path"?: string,"p_name"?: string,"p_position"?: number,"p_price"?: number }; Returns: Json
                           }
          }
          Enums: {
            "billing_period": "quarterly"|"annual","campaign_status": "pending"|"sending"|"sent"|"failed","coupon_source": "card_reward"|"wheel"|"push"|"birthday","coupon_status": "active"|"redeemed","customer_status": "active"|"deleted","cycle_status": "active"|"completed"|"expired","device_platform": "ios"|"android","merchant_category": "restaurantes"|"cafeterias_postres"|"bares_snacks"|"barberias"|"belleza"|"spas"|"deporte_salud"|"servicios"|"otros","relation_origin": "add_card"|"first_stamp","subscription_status": "active"|"past_due"|"inactive","wheel_prize_type": "coupon"|"extra_stamp"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "billing_period": ["quarterly", "annual"],"campaign_status": ["pending", "sending", "sent", "failed"],"coupon_source": ["card_reward", "wheel", "push", "birthday"],"coupon_status": ["active", "redeemed"],"customer_status": ["active", "deleted"],"cycle_status": ["active", "completed", "expired"],"device_platform": ["ios", "android"],"merchant_category": ["restaurantes", "cafeterias_postres", "bares_snacks", "barberias", "belleza", "spas", "deporte_salud", "servicios", "otros"],"relation_origin": ["add_card", "first_stamp"],"subscription_status": ["active", "past_due", "inactive"],"wheel_prize_type": ["coupon", "extra_stamp"]
          }
        }
} as const
