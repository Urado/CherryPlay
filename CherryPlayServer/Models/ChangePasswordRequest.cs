using System.ComponentModel.DataAnnotations;
using CherryPlayServer.Core;

namespace CherryPlayServer.Models;

public record ChangePasswordRequest(
    [Required]
    string OldPassword,
    [Required]
    [MinLength(AuthConstants.MinPasswordLength)]
    string NewPassword
);
