import { Injectable, BadRequestException } from '@nestjs/common';
import {
  PaginationDto,
  PaginatedResult,
  PaginationMeta,
  PrismaPaginationParams
} from '../dto/pagination.dto';

@Injectable()
export class PaginationService {
  private readonly DEFAULT_PAGE = 1;
  private readonly DEFAULT_LIMIT = 10;
  private readonly MAX_LIMIT = 100;

  createPaginatedResult<T>(
    data: T[],
    total: number,
    pagination: PaginationDto,
  ): PaginatedResult<T> {
    if (pagination.skip) {
      return {
        meta: {
          page: 1,
          limit: total,
          total,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        data,
      };
    }
    const page = pagination.page || this.DEFAULT_PAGE;
    const limit = pagination.limit || this.DEFAULT_LIMIT;

    // Validate inputs
    this.validatePaginationInput(page, limit, total);

    const totalPages = this.calculateTotalPages(total, limit);

    const meta: PaginationMeta = {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };

    return {
      meta,
      data,
    };
  }

  getSkip(pagination: PaginationDto): number {
    if (pagination.skip) {
      return 0;
    } else {
      const page = pagination.page || this.DEFAULT_PAGE;
      const limit = pagination.limit || this.DEFAULT_LIMIT;
      return (page - 1) * limit;
    }
  }

  getLimit(pagination: PaginationDto): number {
    return pagination.limit || this.DEFAULT_LIMIT;
  }

  getPaginationParams(pagination: PaginationDto): PrismaPaginationParams {
    if (pagination.skip) {
      return {
        skip: 0,
        take: undefined, // No limit when skip=true
      };
    }
    return {
      skip: this.getSkip(pagination),
      take: this.getLimit(pagination),
    };
  }

  calculateTotalPages(total: number, limit: number): number {
    if (total === 0) return 0;
    return Math.ceil(total / limit);
  }

  private validatePaginationInput(
    page: number,
    limit: number,
    total?: number,
  ): void {
    if (page < 1) {
      throw new BadRequestException('Page number must be greater than 0');
    }

    if (limit < 1 || limit > this.MAX_LIMIT) {
      throw new BadRequestException(
        `Limit must be between 1 and ${this.MAX_LIMIT}`,
      );
    }

    // Check if page exceeds total pages
    if (total !== undefined && total > 0) {
      const totalPages = this.calculateTotalPages(total, limit);
      if (page > totalPages) {
        throw new BadRequestException(
          `Page ${page} exceeds total pages (${totalPages})`,
        );
      }
    }
  }

  isValidPage(page: number, total: number, limit: number): boolean {
    if (total === 0) return page === 1;
    const totalPages = this.calculateTotalPages(total, limit);
    return page >= 1 && page <= totalPages;
  }

  getPageRange(
    currentPage: number,
    totalPages: number,
    range: number = 2,
  ): number[] {
    const start = Math.max(1, currentPage - range);
    const end = Math.min(totalPages, currentPage + range);

    const pages: number[] = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  createEmptyPaginatedResult<T>(
    pagination: PaginationDto,
  ): PaginatedResult<T> {
    return this.createPaginatedResult<T>([], 0, pagination);
  }

  getAllWithoutPagination<T>(
    data: T[],
    total?: number,
  ): PaginatedResult<T> {
    return this.createPaginatedResult<T>(data, total || 0, { page: 1, limit: total || 0 });
  }
}