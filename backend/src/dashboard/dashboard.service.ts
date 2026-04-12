import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

const GLOBAL_ROLES = ['SYSTEM_ADMIN', 'GENERAL_SECRETARY', 'GS_OFFICE_STAFF'];
const COUNCIL_ROLES = ['COUNCIL_SECRETARY', 'COUNCIL_PRESIDENT', 'COUNCIL_MEMBER', 'COUNCIL_STAFF', 'EXAM_OFFICER'];
const DEPT_ROLES = ['DEPT_STAFF', 'DEPT_MANAGER'];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(
    user: JwtPayload,
    query: {
      councilId?: string;
      fromDate?: string;
      toDate?: string;
      status?: string;
    },
  ) {
    const topicWhere: any = {};
    const meetingWhere: any = {};
    const decisionWhere: any = {};

    // ── Role-based scoping ──
    const roleCodes = user.roles.map((r) => r.code);
    const isGlobal = roleCodes.some((c) => GLOBAL_ROLES.includes(c));

    if (!isGlobal) {
      const councilIds = user.roles
        .filter((r) => COUNCIL_ROLES.includes(r.code) && r.councilId)
        .map((r) => r.councilId!);
      const isDept = roleCodes.some((c) => DEPT_ROLES.includes(c));

      if (councilIds.length > 0 && isDept) {
        // User has both council + dept roles — show their councils' data + their own topics
        topicWhere.OR = [
          { councilId: { in: councilIds } },
          { createdById: user.sub },
        ];
        meetingWhere.councilId = { in: councilIds };
        decisionWhere.topic = { councilId: { in: councilIds } };
      } else if (councilIds.length > 0) {
        topicWhere.councilId = { in: councilIds };
        meetingWhere.councilId = { in: councilIds };
        decisionWhere.topic = { councilId: { in: councilIds } };
      } else if (isDept) {
        // Dept-only users see only their own topics
        topicWhere.createdById = user.sub;
        meetingWhere.id = '__none__'; // no meetings
        decisionWhere.id = '__none__';
      }
    }

    // ── Optional filters (applied on top of scoping) ──
    if (query.councilId) {
      topicWhere.councilId = query.councilId;
      meetingWhere.councilId = query.councilId;
      if (!decisionWhere.topic) decisionWhere.topic = {};
      decisionWhere.topic.councilId = query.councilId;
    }

    if (query.status) {
      topicWhere.status = query.status;
    }

    if (query.fromDate || query.toDate) {
      const dateFilter: any = {};
      if (query.fromDate) dateFilter.gte = new Date(query.fromDate);
      if (query.toDate) dateFilter.lte = new Date(query.toDate);
      topicWhere.createdAt = dateFilter;
      meetingWhere.createdAt = dateFilter;
      decisionWhere.createdAt = dateFilter;
    }

    const [topicsCount, meetingsCount, decisionsCount, returnsCount] =
      await Promise.all([
        this.prisma.topic.count({ where: topicWhere }),
        this.prisma.meeting.count({ where: meetingWhere }),
        this.prisma.decision.count({ where: decisionWhere }),
        this.prisma.topic.count({
          where: { ...topicWhere, returnType: { not: null } },
        }),
      ]);

    // Departments breakdown
    const allTopics = await this.prisma.topic.findMany({
      where: topicWhere,
      select: {
        requestingOrgId: true,
        requestingOrg: { select: { id: true, name: true } },
      },
    });

    const deptMap = new Map<string, { orgId: string; orgName: string; count: number }>();
    for (const t of allTopics) {
      const existing = deptMap.get(t.requestingOrgId);
      if (existing) {
        existing.count++;
      } else {
        deptMap.set(t.requestingOrgId, {
          orgId: t.requestingOrg.id,
          orgName: t.requestingOrg.name,
          count: 1,
        });
      }
    }
    const departmentsBreakdown = Array.from(deptMap.values()).sort(
      (a, b) => b.count - a.count,
    );

    // Status breakdown
    const allTopicsForStatus = await this.prisma.topic.groupBy({
      by: ['status'],
      where: topicWhere,
      _count: { id: true },
    });
    const statusBreakdown = allTopicsForStatus.map((g: any) => ({
      status: g.status,
      count: g._count.id,
    }));

    // Council breakdown
    const topicsByCouncil = await this.prisma.topic.findMany({
      where: topicWhere,
      select: {
        councilId: true,
        council: { select: { id: true, name: true } },
      },
    });
    const decisionsByCouncil = await this.prisma.decision.findMany({
      where: decisionWhere,
      select: {
        topic: {
          select: {
            councilId: true,
            council: { select: { id: true, name: true } },
          },
        },
      },
    });

    const councilMap = new Map<
      string,
      { councilId: string; councilName: string; topics: number; decisions: number }
    >();

    for (const t of topicsByCouncil) {
      const existing = councilMap.get(t.councilId);
      if (existing) {
        existing.topics++;
      } else {
        councilMap.set(t.councilId, {
          councilId: t.council.id,
          councilName: t.council.name,
          topics: 1,
          decisions: 0,
        });
      }
    }

    for (const d of decisionsByCouncil) {
      const cId = d.topic.councilId;
      const existing = councilMap.get(cId);
      if (existing) {
        existing.decisions++;
      } else {
        councilMap.set(cId, {
          councilId: d.topic.council.id,
          councilName: d.topic.council.name,
          topics: 0,
          decisions: 1,
        });
      }
    }
    const councilBreakdown = Array.from(councilMap.values());

    return {
      topicsCount,
      meetingsCount,
      decisionsCount,
      returnsCount,
      departmentsBreakdown,
      statusBreakdown,
      councilBreakdown,
    };
  }
}
