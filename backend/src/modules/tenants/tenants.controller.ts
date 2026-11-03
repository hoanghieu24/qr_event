import { Request, Response } from 'express';
import { TenantsService } from './tenants.service';

export class TenantsController {
  static async getTenantUsers(req: Request, res: Response) {
    try {
      const tenantId = Number(req.params.id);
      res.json({ success: true, data: await TenantsService.getTenantUsers(tenantId) });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async addTenantMember(req: Request, res: Response) {
    try {
      const tenantId = Number(req.params.id);
      const result = await TenantsService.createTeamMember(tenantId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async removeTenantMember(req: Request, res: Response) {
    try {
      const tenantId = Number(req.params.id);
      const userId = Number(req.params.userId);
      const result = await TenantsService.removeMemberFromTenant(tenantId, userId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async allTenantEvents(req: Request, res: Response) {
    try {
      res.json({ success: true, data: await TenantsService.allTenantEvents() });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async list(req: Request, res: Response) {
    try {
      res.json({ success: true, data: await TenantsService.listTenants() });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async register(req: Request, res: Response) {
    try {
      const { name, contact_name, email, phone, password } = req.body;
      if (!name || !email || !password) {
        res.status(400).json({ success: false, message: 'Vui lòng điền đủ tên đơn vị, email và mật khẩu.' });
        return;
      }
      const result = await TenantsService.registerTenant({
        name: String(name).trim(),
        contact_name: contact_name ? String(contact_name).trim() : undefined,
        email: String(email).trim().toLowerCase(),
        phone: phone ? String(phone).trim() : undefined,
        password: String(password),
      });
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      if (!req.user) return;
      const { name, contact_name, contact_email, phone, owner_name, owner_email, owner_password } = req.body;
      if (![name, contact_name, contact_email, owner_name, owner_email, owner_password].every((v) => typeof v === 'string' && v.trim())) {
        res.status(400).json({ success: false, message: 'Vui lòng điền đủ thông tin khách thuê và tài khoản quản lý.' });
        return;
      }
      const tenant = await TenantsService.createTenant({
        name: name.trim(), contact_name: contact_name.trim(), contact_email: contact_email.trim().toLowerCase(),
        phone: phone?.trim(), owner_name: owner_name.trim(), owner_email: owner_email.trim().toLowerCase(),
        owner_password, created_by: req.user.id,
      });
      res.status(201).json({ success: true, data: tenant });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async setStatus(req: Request, res: Response) {
    try {
      const status = req.body.status;
      if (!['ACTIVE', 'BLOCKED'].includes(status)) {
        res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ.' });
        return;
      }
      res.json({ success: true, data: await TenantsService.setTenantStatus(Number(req.params.id), status) });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async events(req: Request, res: Response) {
    try {
      res.json({ success: true, data: await TenantsService.listEvents(Number(req.user!.tenantId)) });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async usage(req: Request, res: Response) {
    try {
      res.json({ success: true, data: await TenantsService.getUsage(Number(req.user!.tenantId)) });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async paymentInfo(req: Request, res: Response) {
    try {
      res.json({ success: true, data: await TenantsService.getPaymentInfo() });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async createEvent(req: Request, res: Response) {
    try {
      const { name, description, location, poster_base64, start_at, end_at, capacity, approval_mode, event_package_id, plan_id, staff_assignments } = req.body;
      if (![name, location, start_at, end_at].every((value) => typeof value === 'string' && value.trim())) {
        res.status(400).json({ success: false, message: 'Vui lòng nhập tên, địa điểm, thời gian bắt đầu và kết thúc.' });
        return;
      }
      if (new Date(end_at).getTime() <= new Date(start_at).getTime()) {
        res.status(400).json({ success: false, message: 'Thời gian kết thúc phải sau thời gian bắt đầu.' });
        return;
      }
      const event = await TenantsService.createEvent(Number(req.user!.tenantId), req.user!.id, {
        name: name.trim(), description: description?.trim(), location: location.trim(), poster_base64,
        start_at, end_at, capacity: Number(capacity) > 0 ? Number(capacity) : undefined,
        event_package_id: event_package_id || undefined, plan_id: plan_id || undefined, approval_mode, staff_assignments,
      });
      res.status(201).json({ success: true, data: event });
    } catch (error: any) {
      res.status(['EVENT_QUOTA_EXCEEDED', 'TRIAL_PACKAGE_UNAVAILABLE'].includes(error.code) ? 402 : 400).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
  }

  static async updateEvent(req: Request, res: Response) {
    try {
      res.json({
        success: true,
        data: await TenantsService.updateEvent(Number(req.user!.tenantId), Number(req.params.eventId), req.body)
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async closeEvent(req: Request, res: Response) {
    try {
      res.json({ success: true, data: await TenantsService.closeEvent(Number(req.user!.tenantId), Number(req.params.eventId)) });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async attendees(req: Request, res: Response) {
    try {
      res.json({ success: true, data: await TenantsService.getAttendees(Number(req.user!.tenantId), Number(req.params.eventId)) });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async listTeam(req: Request, res: Response) {
    try {
      res.json({ success: true, data: await TenantsService.listTeam(Number(req.user!.tenantId)) });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async searchUsers(req: Request, res: Response) {
    try {
      const term = String(req.query.term || '');
      const users = await TenantsService.searchUsers(Number(req.user!.tenantId), term);
      res.json({ success: true, data: users });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async createTeamMember(req: Request, res: Response) {
    try {
      const { user_id, name, email, phone, password } = req.body;
      if (!user_id && !email) {
        res.status(400).json({ success: false, message: 'Vui lòng chọn người dùng hoặc nhập email.' });
        return;
      }
      const member = await TenantsService.createTeamMember(Number(req.user!.tenantId), {
        user_id: user_id ? Number(user_id) : undefined,
        name: name ? String(name).trim() : undefined,
        email: email ? String(email).trim().toLowerCase() : undefined,
        phone: phone ? String(phone).trim() : undefined,
        password: password ? String(password) : undefined,
      });
      res.status(201).json({ success: true, data: member });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async eventTeam(req: Request, res: Response) {
    try {
      res.json({ success: true, data: await TenantsService.listEventTeam(Number(req.user!.tenantId), Number(req.params.eventId)) });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async assignTeamMember(req: Request, res: Response) {
    try {
      const { staff_id: bodyStaffId, role, max_invites, is_enabled } = req.body;
      const staff_id = Number(req.params.staffId || bodyStaffId);
      if (!staff_id || !role) {
        res.status(400).json({ success: false, message: 'Vui lòng chọn nhân sự và vai trò.' });
        return;
      }
      const result = await TenantsService.assignTeamMember(Number(req.user!.tenantId), Number(req.params.eventId), {
        staff_id: Number(staff_id), role: String(role), max_invites: Number(max_invites ?? 50), is_enabled,
      });
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async removeTeamMember(req: Request, res: Response) {
    try {
      const result = await TenantsService.removeTeamMember(
        Number(req.user!.tenantId), Number(req.params.eventId), Number(req.params.staffId)
      );
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
