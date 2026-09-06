import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
    selector: 'app-main',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './main.html',
    styleUrls: ['./main.css']
})
export class Main implements OnInit {
    isLoggedIn: boolean = false;
    currentUser: any = null;

    private authService = inject(AuthService);
    private router = inject(Router);

    // จำลองข้อมูลร้านอาหารขึ้นมาแสดงผลชั่วคราว
    restaurants = [
        { id: 1, name: 'Chill Bar & Restaurant', description: 'ร้านนั่งชิล บรรยากาศดี ดนตรีสดฟังสบาย', image: 'https://via.placeholder.com/400x250/eeeeee/333333?text=Chill+Bar' },
        { id: 2, name: 'Night Owl Club', description: 'ผับสายแดนซ์ EDM จัดเต็มตลอดคืน', image: 'https://via.placeholder.com/400x250/eeeeee/333333?text=Night+Owl' },
        { id: 3, name: 'Rooftop Sky', description: 'ดินเนอร์หรูบนดาดฟ้า พร้อมวิวเมืองหลักล้าน', image: 'https://via.placeholder.com/400x250/eeeeee/333333?text=Rooftop+Sky' }
    ];

    ngOnInit(): void {
        // โหลดสถานะผู้ใช้เพื่อนำไปใช้เปิด/ปิดฟีเจอร์บนหน้าจอ
        this.authService.currentUser$.subscribe(user => {
            this.currentUser = user;
            this.isLoggedIn = !!user;
        });
    }

    // ฟังก์ชันทำงานเมื่อผู้ใช้กดปุ่ม "จองโต๊ะ"
    onBookTable(restaurantId: number): void {
        if (this.isLoggedIn) {
            // ถ้าเป็นสมาชิกแล้ว ให้เปิดระบบจองได้เลย (สมมติว่ากดแล้วแจ้งเตือนก่อน)
            alert(`เปิดระบบจองโต๊ะสำหรับร้านหมายเลข: ${restaurantId}`);
            // อนาคตจะใช้ this.router.navigate(['/booking', restaurantId]);
        } else {
            // ถ้ายังไม่ได้ล็อกอิน ให้บังคับไปหน้า Login ทันที
            this.router.navigate(['/auth/login']);
        }
    }
}